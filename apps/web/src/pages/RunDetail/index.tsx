import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Empty, Modal, Progress, Row, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { CopyOutlined, ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { analyzeScreenshot } from "../../api/ai";
import { AiThinking } from "../../components/AiThinking";
import { createBatchTestRun, createTestRun, eventSourceUrl, getBatchTestRun, getTestRun, getTestRunLogs } from "../../api/testRuns";
import { LogTerminal } from "../../components/LogTerminal";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { PageHeader } from "../../components/PageHeader";
import { ReportLinks } from "../../components/ReportLinks";
import { RunStatusCard } from "../../components/RunStatusCard";
import { StepTimeline } from "../../components/StepTimeline";
import { TypewriterMarkdownViewer } from "../../components/TypewriterMarkdownViewer";
import { SCREENSHOT_PREVIEW_MAX_HEIGHT_CLASS, SCREENSHOT_PREVIEW_MODAL_WIDTH } from "../../components/image-preview";
import { useRunStore } from "../../stores/useRunStore";
import type { BatchTestRunSummary, StepResult, TestRunEvent } from "../../types/run";
import { toScreenshotUrl } from "../../utils/artifact-url";
import { formatDuration, formatTime } from "../../utils/format";
import { buildBatchProgressView } from "./batch-progress";
import { buildBatchReportDetailPath, buildBatchReportModePath } from "./batch-report-links";
import { buildRerunCaseRequest, canRerunCase } from "./rerun-case";
import { createStepUpdateBatcher } from "./step-update-batcher";

interface DetailPreview {
  title: string;
  content: string;
  danger?: boolean;
}

export default function RunDetail() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { run, logs, setSummary, updateSteps, setLogs, setRun, reset, currentBatchId, setCurrentBatchId } = useRunStore();
  const runId = params.runId === "latest" ? "latest" : params.runId;
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoadingStep, setAiLoadingStep] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiStepId, setAiStepId] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<{ title: string; src: string }>();
  const [detailPreview, setDetailPreview] = useState<DetailPreview>();
  const [runLoadError, setRunLoadError] = useState("");
  const [latestMissing, setLatestMissing] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);
  const [batchRerunLoading, setBatchRerunLoading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchTestRunSummary>();
  const queryBatchId = searchParams.get("batchId") ?? "";
  const batchId = params.runId === "latest" ? queryBatchId || currentBatchId : "";

  useEffect(() => {
    if (queryBatchId && queryBatchId !== currentBatchId) {
      setCurrentBatchId(queryBatchId);
    }
  }, [currentBatchId, queryBatchId, setCurrentBatchId]);

  useEffect(() => {
    if (!runId) return;
    let canceled = false;
    setLatestMissing(false);

    async function loadRun() {
      try {
        const nextRun = await getTestRun(runId!);
        if (canceled) return;
        if (!nextRun) {
          reset();
          setLogs("");
          setRunLoadError("");
          setLatestMissing(params.runId === "latest");
          return;
        }
        setLatestMissing(false);
        setSummary(nextRun);
        setRunLoadError("");

        const nextLogs = await getTestRunLogs(nextRun.runId).catch(() => "");
        if (!canceled && nextLogs) {
          setLogs(nextLogs);
        }
      } catch (error) {
        if (!canceled) {
          const message = error instanceof Error ? error.message : String(error);
          setRunLoadError(message);
          if (params.runId === "latest" && isNoHistoryError(message)) {
            reset();
            setLogs("");
            setLatestMissing(true);
            setRunLoadError("");
          }
        }
      }
    }

    void loadRun();
    return () => {
      canceled = true;
    };
  }, [params.runId, reset, runId, setLogs, setSummary]);

  useEffect(() => {
    if (!runId || run?.status !== "running") return;
    const source = new EventSource(eventSourceUrl(runId));
    const stepUpdateBatcher = createStepUpdateBatcher({
      schedule: (callback) => window.requestAnimationFrame(callback),
      cancel: (frame) => window.cancelAnimationFrame(frame),
      onSteps: updateSteps
    });
    source.addEventListener("step_updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TestRunEvent;
      if (payload.step) {
        stepUpdateBatcher.enqueue(payload.step);
      }
    });
    source.addEventListener("run_finished", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TestRunEvent;
      stepUpdateBatcher.flush();
      setRun({ status: payload.status === "failed" ? "failed" : "passed" });
      getTestRun(runId).then((nextRun) => nextRun && setSummary(nextRun)).catch(() => undefined);
      getTestRunLogs(runId).then(setLogs).catch(() => undefined);
      source.close();
    });
    return () => {
      stepUpdateBatcher.cancel();
      source.close();
    };
  }, [run?.status, runId, setLogs, setRun, setSummary, updateSteps]);

  useEffect(() => {
    if (!batchId) {
      setBatchSummary(undefined);
      return;
    }
    let canceled = false;
    let timer: number | undefined;

    async function pollBatch() {
      try {
        const nextBatch = await getBatchTestRun(batchId);
        if (canceled) return;
        if (!nextBatch) {
          setBatchSummary(undefined);
          if (batchId === currentBatchId) {
            setCurrentBatchId("");
          }
          return;
        }
        setBatchSummary(nextBatch);

        const nextRun = await getTestRun("latest").catch(() => null);
        if (!canceled && nextRun) {
          setSummary(nextRun);
          const nextLogs = await getTestRunLogs(nextRun.runId).catch(() => "");
          if (!canceled) {
            setLogs(nextLogs);
          }
        }

        if (!canceled && nextBatch.status === "running") {
          timer = window.setTimeout(pollBatch, 1200);
        }
      } catch (error) {
        if (!canceled) {
          messageApi.error(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void pollBatch();
    return () => {
      canceled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [batchId, messageApi, setLogs, setSummary]);

  const data = useMemo(() => run?.steps ?? [], [run?.steps]);
  const failureAnalysisStep = useMemo(() => data.find((step) => step.status === "failed" && step.aiAnalysis), [data]);

  async function handleAnalyze(step: StepResult) {
    if (!step.screenshot) return;
    setAiStepId(step.stepId);
    setAiModalOpen(true);
    setAiLoadingStep(step.stepId);
    setAiAnalysis("");
    try {
      setAiAnalysis(await analyzeScreenshot({ screenshotPath: step.screenshot, runId: run?.runId, stepId: step.stepId, error: step.error }));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAiLoadingStep("");
    }
  }

  async function copyText(text: string, successMessage: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    messageApi.success(successMessage);
  }

  function openDetail(title: string, content: string, danger = false) {
    setDetailPreview({ title, content, danger });
  }

  async function handleRerunCase() {
    if (!canRerunCase(run)) return;
    setRerunLoading(true);
    try {
      const created = await createTestRun(buildRerunCaseRequest(run));
      const nextRun = await getTestRun(created.runId);
      if (nextRun) {
        setSummary(nextRun);
      } else {
        setRun({ runId: created.runId, caseId: run.caseId, status: created.status });
      }
      setLogs("");
      setRunLoadError("");
      navigate(`/runs/${created.runId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRerunLoading(false);
    }
  }

  async function handleRerunFailedBatch() {
    const failedCaseIds = batchSummary?.items
      .filter((item) => item.status === "failed")
      .map((item) => item.caseId) ?? [];
    if (!batchSummary || !failedCaseIds.length) return;

    setBatchRerunLoading(true);
    try {
      const created = await createBatchTestRun({ caseIds: failedCaseIds, env: batchSummary.env });
      setCurrentBatchId(created.batchId);
      setBatchSummary(undefined);
      navigate(`/runs/latest?batchId=${encodeURIComponent(created.batchId)}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBatchRerunLoading(false);
    }
  }

  if (!runId || (params.runId === "latest" && latestMissing && !batchId)) {
    return (
      <div className="flex flex-col gap-2.5">
        {contextHolder}
        <PageHeader
          title="执行详情"
          description="暂无运行记录，请先从运行工作台启动一个用例。"
          extra={
            <Space>
              <Button onClick={() => navigate("/dashboard")}>返回工作台</Button>
              <Link to="/cases">返回用例</Link>
            </Space>
          }
        />
        <Card>
          <Empty description="暂无执行详情" />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-1">
      {contextHolder}
      <PageHeader
        title="执行详情"
        description={runId}
        extra={
          <Space>
            {canRerunCase(run) && !batchSummary ? (
              <Button type="primary" icon={<ReloadOutlined />} loading={rerunLoading} onClick={() => void handleRerunCase()}>
                重新执行用例
              </Button>
            ) : null}
            <Button onClick={() => navigate(`/reports/${runId}`)}>查看报告</Button>
            <Link to="/cases">返回用例</Link>
          </Space>
        }
      />
      {runLoadError ? (
        <Alert
          type="warning"
          showIcon
          title="服务端运行记录暂不可用"
          description="当前页面会保留已有前端缓存数据。通常是服务端重启后内存运行记录丢失，重新执行用例即可生成新的详情、日志和报告。"
          action={
            <Space>
              <Button size="small" onClick={() => navigate("/dashboard")}>
                返回工作台
              </Button>
              <Button size="small" onClick={() => setRunLoadError("")}>
                收起
              </Button>
            </Space>
          }
        />
      ) : null}
      <Row gutter={[10, 10]} className="min-h-0 flex-none overflow-visible pb-2.5">
        <Col xs={24} xl={15} xxl={16} className="min-h-0 overflow-visible pr-0 xl:pr-1">
          <Space orientation="vertical" size={10} className="w-full pb-1">
            {batchSummary ? <BatchProgressCard batch={batchSummary} rerunFailedLoading={batchRerunLoading} onRerunFailed={() => void handleRerunFailedBatch()} /> : null}
            <RunStatusCard run={run} />
            {failureAnalysisStep ? (
              <Card
                title={
                  <Space>
                    <RobotOutlined />
                    <span>自动失败分析</span>
                    <Tag color="error">{failureAnalysisStep.stepId}</Tag>
                  </Space>
                }
                extra={
                  failureAnalysisStep.aiAnalysis?.content ? (
                    <Button size="small" onClick={() => void copyText(failureAnalysisStep.aiAnalysis?.content ?? "", "AI 分析已复制")}>
                      复制全部
                    </Button>
                  ) : null
                }
              >
                {failureAnalysisStep.aiAnalysis?.status === "pending" ? (
                  <div className="max-h-[460px] min-h-[300px] overflow-auto rounded-lg bg-slate-950 p-5">
                    <div className="mb-2.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
                      <AiThinking />
                    </div>
                    {failureAnalysisStep.aiAnalysis.content ? (
                      <MarkdownViewer
                        content={failureAnalysisStep.aiAnalysis.content}
                        className="max-h-none min-h-0 overflow-visible rounded-none bg-transparent p-0"
                        onCopyCode={(code) => void copyText(code, "代码块已复制")}
                      />
                    ) : null}
                  </div>
                ) : failureAnalysisStep.aiAnalysis?.status === "completed" && failureAnalysisStep.aiAnalysis.content ? (
                  <TypewriterMarkdownViewer
                    content={failureAnalysisStep.aiAnalysis.content}
                    className="max-h-[460px] min-h-[300px] overflow-auto rounded-lg bg-slate-950 p-5"
                    onCopyCode={(code) => void copyText(code, "代码块已复制")}
                  />
                ) : (
                  <Alert type="warning" showIcon title="AI 分析失败" description={failureAnalysisStep.aiAnalysis?.error ?? "未返回分析结果"} />
                )}
              </Card>
            ) : null}
            <Card title="步骤明细" className="run-detail-step-card shrink-0 [&_.ant-card-body]:overflow-hidden">
              <Table<StepResult>
                className="run-detail-step-table"
                rowKey="stepId"
                dataSource={data}
                pagination={false}
                sticky
                scroll={{ x: 1760, y: 360 }}
                columns={[
                  { title: "#", width: 56, render: (_, __, index) => index + 1 },
                  { title: "step_id", dataIndex: "stepId", width: 220 },
                  { title: "名称", dataIndex: "name", width: 220 },
                  { title: "类型", dataIndex: "type", width: 150 },
                  { title: "会话", dataIndex: "session", width: 100, render: (value) => value ?? "-" },
                  { title: "状态", dataIndex: "status", width: 100, render: (value) => <Tag color={statusColor(value)}>{statusText(value)}</Tag> },
                  { title: "开始时间", dataIndex: "startedAt", width: 120, render: formatTime },
                  { title: "耗时", dataIndex: "durationMs", width: 100, render: formatDuration },
                  {
                    title: "数据/接口",
                    dataIndex: "data",
                    width: 180,
                    render: (value: unknown | undefined, record) =>
                      renderDetailCell({
                        content: formatDetailContent(value),
                        empty: value === undefined,
                        onOpen: () => openDetail(`数据/接口：${record.stepId}`, formatDetailContent(value))
                      })
                  },
                  {
                    title: "错误摘要",
                    dataIndex: "error",
                    width: 320,
                    render: (value: string | undefined, record) =>
                      renderDetailCell({
                        content: value ?? "",
                        empty: !value,
                        danger: true,
                        onOpen: () => openDetail(`错误详情：${record.stepId}`, value ?? "", true)
                      })
                  },
                  {
                    title: "诊断",
                    width: 230,
                    render: (_, record) =>
                      record.screenshot || record.aiAnalysis ? (
                        <Space wrap>
                          {record.aiAnalysis?.status === "pending" ? (
                            <Tag color="processing">AI 分析中</Tag>
                          ) : record.aiAnalysis?.status === "completed" ? (
                            <Tag color="success">AI 已分析</Tag>
                          ) : record.aiAnalysis?.status === "failed" ? (
                            <Tooltip title={record.aiAnalysis.error}>
                              <Tag color="error">AI 失败</Tag>
                            </Tooltip>
                          ) : null}
                          {record.screenshot ? (
                            <>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => setScreenshotPreview({ title: record.stepId, src: toScreenshotUrl(record.screenshot!) })}
                              >
                                查看
                              </Button>
                              <Button size="small" icon={<RobotOutlined />} loading={aiLoadingStep === record.stepId} onClick={() => void handleAnalyze(record)}>
                                AI
                              </Button>
                            </>
                          ) : null}
                        </Space>
                      ) : "-"
                  }
                ]}
              />
            </Card>
          </Space>
        </Col>
        <Col xs={24} xl={9} xxl={8} className="min-h-0 pr-0 xl:pr-1">
          <div className="flex min-h-0 flex-col gap-2.5 pb-1">
            <Card
              title="步骤时间线"
              className="h-[300px] shrink-0 overflow-hidden [&_.ant-card-body]:h-[236px] [&_.ant-card-body]:overflow-auto [&_.ant-card-body]:pr-2"
            >
              <StepTimeline steps={data} />
            </Card>
            <Card title="报告链接" className="shrink-0">
              <ReportLinks run={run} />
            </Card>
            <LogTerminal logs={logs} className="h-[620px] shrink-0" heightClassName="" />
          </div>
        </Col>
      </Row>
      <Modal
        title={aiStepId ? `AI 截图分析：${aiStepId}` : "AI 截图分析"}
        open={aiModalOpen}
        width="min(860px, 92vw)"
        footer={
          <Space>
            <Button onClick={() => setAiModalOpen(false)}>关闭</Button>
            <Button type="primary" disabled={!aiAnalysis} onClick={() => void copyText(aiAnalysis, "AI 分析已复制")}>
              复制全部
            </Button>
          </Space>
        }
        destroyOnHidden
        onCancel={() => setAiModalOpen(false)}
      >
        <div className="max-h-[62vh] min-h-[260px] overflow-auto rounded-lg bg-slate-950 p-5">
          {aiLoadingStep ? (
            <div className="mb-2.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
              <AiThinking />
            </div>
          ) : null}
          {aiAnalysis ? (
            <TypewriterMarkdownViewer
              content={aiAnalysis}
              className="max-h-none min-h-0 overflow-visible rounded-none bg-transparent p-0"
              onCopyCode={(code) => void copyText(code, "代码块已复制")}
            />
          ) : !aiLoadingStep ? (
            <MarkdownViewer content="暂无分析结果。" className="max-h-none min-h-0 overflow-visible rounded-none bg-transparent p-0" />
          ) : null}
        </div>
      </Modal>
      <Modal
        title={screenshotPreview ? `失败截图：${screenshotPreview.title}` : "失败截图"}
        open={Boolean(screenshotPreview)}
        width={SCREENSHOT_PREVIEW_MODAL_WIDTH}
        footer={null}
        destroyOnHidden
        onCancel={() => setScreenshotPreview(undefined)}
      >
        {screenshotPreview ? (
          <div className={`${SCREENSHOT_PREVIEW_MAX_HEIGHT_CLASS} overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3`}>
            <img src={screenshotPreview.src} alt={screenshotPreview.title} className="mx-auto max-w-full rounded bg-white shadow-sm" />
          </div>
        ) : null}
      </Modal>
      <Modal
        title={detailPreview?.title ?? "详情"}
        open={Boolean(detailPreview)}
        width={920}
        destroyOnHidden
        onCancel={() => setDetailPreview(undefined)}
        footer={
          <Space>
            <Button onClick={() => setDetailPreview(undefined)}>关闭</Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              disabled={!detailPreview?.content}
              onClick={() => void copyText(detailPreview?.content ?? "", "详情已复制")}
            >
              复制
            </Button>
          </Space>
        }
      >
        {detailPreview ? (
          <pre
            className={`m-0 max-h-[62vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3.5 font-mono text-xs leading-relaxed ${
              detailPreview.danger
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-slate-950 text-slate-100"
            }`}
          >
            {detailPreview.content}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}

function renderDetailCell(props: { content: string; empty: boolean; danger?: boolean; onOpen: () => void }) {
  if (props.empty) {
    return <span className="text-slate-400">-</span>;
  }
  const preview = compactPreview(props.content);
  return (
    <button
      type="button"
      className={`flex max-w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-xs ${
        props.danger ? "text-red-500" : "text-slate-600"
      }`}
      onClick={props.onOpen}
    >
      <Typography.Text className={`!max-w-[260px] !font-mono !text-xs ${props.danger ? "!text-red-500" : "!text-slate-600"}`} ellipsis>
        {preview}
      </Typography.Text>
      <span className="shrink-0 text-blue-600">详情</span>
    </button>
  );
}

function BatchProgressCard(props: { batch: BatchTestRunSummary; rerunFailedLoading?: boolean; onRerunFailed?: () => void }) {
  const { batch } = props;
  const progress = buildBatchProgressView(batch);
  const failedCount = batch.items.filter((item) => item.status === "failed").length;

  return (
    <Card
      title="批量执行进度"
      extra={
        <Space>
          {batch.status !== "running" && failedCount ? (
            <Button size="small" type="primary" danger loading={props.rerunFailedLoading} onClick={props.onRerunFailed}>
              重跑失败用例({failedCount})
            </Button>
          ) : null}
          <Tag color={batch.status === "running" ? "processing" : batch.status === "passed" ? "success" : "error"}>{batch.status}</Tag>
        </Space>
      }
    >
      <Space size={12} className="mb-3" wrap>
        <Tag>批次 {batch.batchId}</Tag>
        <Tag>总数 {batch.total}</Tag>
        <Tag color="success">通过 {batch.passed}</Tag>
        <Tag color="error">失败 {batch.failed}</Tag>
        <Tag color="processing">运行中 {batch.running}</Tag>
        <Tag>等待 {batch.pending}</Tag>
      </Space>
      <div className="mb-3">
        <div className="mb-1 text-sm text-slate-600">总进度：{progress.completed}/{batch.total}</div>
        <Progress percent={progress.totalPercent} status={progress.totalStatus} />
      </div>
      <div className="mb-3">
        <div className="mb-1 text-sm text-slate-600">当前用例：{progress.currentText}</div>
        <Progress percent={progress.currentPercent} status={progress.currentStatus} />
      </div>
      <Table
        size="small"
        rowKey="caseId"
        pagination={false}
        dataSource={batch.items}
        columns={[
          { title: "用例", dataIndex: "caseName", render: (value, record) => `${record.caseId} - ${value}` },
          { title: "类型", dataIndex: "caseType", width: 120, render: (value) => <Tag>{value}</Tag> },
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (value) => <Tag color={statusColor(value)}>{statusText(value)}</Tag>
          },
          {
            title: "报告入口",
            width: 220,
            render: (_, record) => (
              <Space size={6}>
                {record.runId ? <Link to={buildBatchReportDetailPath({ runId: record.runId, fallbackRunId: "latest" })}>详情</Link> : <span className="text-slate-400">等待</span>}
                {record.runId ? <Link to={`/reports/${record.runId}`}>报告</Link> : null}
                {record.runId || record.reportLinks?.logs ? (
                  <Link to={buildBatchReportModePath("logs", { runId: record.runId, fallbackRunId: "latest" })}>日志</Link>
                ) : null}
              </Space>
            )
          }
        ]}
      />
    </Card>
  );
}

function formatDetailContent(value?: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function compactPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 72)}...`;
}

function statusColor(status: string): string {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "processing";
  return "default";
}

function statusText(status: string): string {
  return ({ pending: "待执行", running: "执行中", passed: "成功", failed: "失败", skipped: "跳过" } as Record<string, string>)[status] ?? status;
}

function isNoHistoryError(message: string): boolean {
  return message.includes("暂无历史运行记录");
}

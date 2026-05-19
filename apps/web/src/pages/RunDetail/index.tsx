import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Modal, Row, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analyzeScreenshotStream } from "../../api/ai";
import { AiThinking } from "../../components/AiThinking";
import { eventSourceUrl, getTestRun, getTestRunLogs } from "../../api/testRuns";
import { LogTerminal } from "../../components/LogTerminal";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { PageHeader } from "../../components/PageHeader";
import { ReportLinks } from "../../components/ReportLinks";
import { RunStatusCard } from "../../components/RunStatusCard";
import { StepTimeline } from "../../components/StepTimeline";
import { useRunStore } from "../../stores/useRunStore";
import type { StepResult, TestRunEvent } from "../../types/run";
import { toScreenshotUrl } from "../../utils/artifact-url";
import { formatDuration, formatTime } from "../../utils/format";

export default function RunDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { run, logs, runId: latestRunId, setSummary, updateStep, setLogs, setRun } = useRunStore();
  const runId = params.runId === "latest" ? latestRunId : params.runId;
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoadingStep, setAiLoadingStep] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiStepId, setAiStepId] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<{ title: string; src: string }>();
  const [runLoadError, setRunLoadError] = useState("");

  useEffect(() => {
    if (!runId) return;
    let canceled = false;

    async function loadRun() {
      try {
        const nextRun = await getTestRun(runId!);
        if (canceled) return;
        setSummary(nextRun);
        setRunLoadError("");

        const nextLogs = await getTestRunLogs(runId!).catch(() => "");
        if (!canceled && nextLogs) {
          setLogs(nextLogs);
        }
      } catch (error) {
        if (!canceled) {
          setRunLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadRun();
    return () => {
      canceled = true;
    };
  }, [runId, setLogs, setSummary]);

  useEffect(() => {
    if (!runId || run?.status !== "running") return;
    const source = new EventSource(eventSourceUrl(runId));
    source.addEventListener("step_updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TestRunEvent;
      if (payload.step) updateStep(payload.step);
    });
    source.addEventListener("run_finished", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TestRunEvent;
      setRun({ status: payload.status === "failed" ? "failed" : "passed" });
      getTestRun(runId).then(setSummary).catch(() => undefined);
      getTestRunLogs(runId).then(setLogs).catch(() => undefined);
      source.close();
    });
    return () => source.close();
  }, [run?.status, runId, setLogs, setRun, setSummary, updateStep]);

  const data = useMemo(() => run?.steps ?? [], [run?.steps]);

  async function handleAnalyze(step: StepResult) {
    if (!step.screenshot) return;
    setAiStepId(step.stepId);
    setAiModalOpen(true);
    setAiLoadingStep(step.stepId);
    setAiAnalysis("");
    let streamError: Error | undefined;
    try {
      await analyzeScreenshotStream(
        { screenshotPath: step.screenshot, stepId: step.stepId, error: step.error },
        {
          onChunk: (chunk) => setAiAnalysis((current) => `${current}${chunk}`),
          onError: (error) => {
            streamError = error;
          }
        }
      );
      if (streamError) {
        throw streamError;
      }
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

  if (!runId) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="执行详情" description="暂无运行记录，请先从工作台启动一个用例。" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {contextHolder}
      <PageHeader
        title="执行详情"
        description={runId}
        extra={
          <Space>
            <Button onClick={() => navigate(`/reports/${runId}`)}>查看报告</Button>
            <Link to="/cases">返回用例</Link>
          </Space>
        }
      />
      {runLoadError ? (
        <Alert
          type="warning"
          showIcon
          message="服务端运行记录暂不可用"
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
      <Row gutter={[16, 16]} className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden">
        <Col xs={24} xl={15} xxl={16} className="min-h-0 overflow-visible pr-0 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
          <Space direction="vertical" size={16} className="w-full pb-1">
            <RunStatusCard run={run} />
            <Card title="步骤明细">
              <Table<StepResult>
                rowKey="stepId"
                dataSource={data}
                pagination={false}
                scroll={{ x: 1380 }}
                columns={[
                  { title: "#", width: 56, render: (_, __, index) => index + 1 },
                  { title: "step_id", dataIndex: "stepId", width: 220 },
                  { title: "名称", dataIndex: "name", width: 220 },
                  { title: "类型", dataIndex: "type", width: 150 },
                  { title: "会话", dataIndex: "session", width: 100, render: (value) => value ?? "-" },
                  { title: "状态", dataIndex: "status", width: 100, render: (value) => <Tag color={statusColor(value)}>{statusText(value)}</Tag> },
                  { title: "开始时间", dataIndex: "startedAt", width: 120, render: formatTime },
                  { title: "耗时", dataIndex: "durationMs", width: 100, render: formatDuration },
                  { title: "数据", dataIndex: "data", width: 160, render: renderStepData },
                  { title: "错误摘要", dataIndex: "error", ellipsis: true, render: (value) => value ?? "-" },
                  {
                    title: "截图",
                    width: 170,
                    render: (_, record) =>
                      record.screenshot ? (
                        <Space>
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
                        </Space>
                      ) : "-"
                  }
                ]}
              />
            </Card>
          </Space>
        </Col>
        <Col xs={24} xl={9} xxl={8} className="min-h-0 pr-0 xl:max-h-full xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
          <div className="flex min-h-0 flex-col gap-4 pb-1">
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
            <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
              <AiThinking />
            </div>
          ) : null}
          {aiAnalysis ? (
            <MarkdownViewer
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
        width="86vw"
        footer={null}
        destroyOnHidden
        onCancel={() => setScreenshotPreview(undefined)}
      >
        {screenshotPreview ? (
          <div className="max-h-[72vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            <img src={screenshotPreview.src} alt={screenshotPreview.title} className="mx-auto max-w-full rounded bg-white shadow-sm" />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function renderStepData(value?: unknown) {
  if (value === undefined) {
    return <span className="text-slate-400">-</span>;
  }
  const text = JSON.stringify(value, null, 2);
  return (
    <Tooltip title={<pre className="m-0 max-w-[560px] whitespace-pre-wrap text-xs">{text}</pre>}>
      <Typography.Text className="!block !font-mono !text-xs !text-slate-600" ellipsis>
        {text}
      </Typography.Text>
    </Tooltip>
  );
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

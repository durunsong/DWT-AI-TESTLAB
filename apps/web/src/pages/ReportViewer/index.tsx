import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Empty, Modal, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography, message } from "antd";
import { CopyOutlined, FileTextOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { useParams, useSearchParams } from "react-router-dom";
import { getTestRun, getTestRunLogs } from "../../api/testRuns";
import { getTestRunReport } from "../../api/reports";
import { PageHeader } from "../../components/PageHeader";
import { LogTerminal } from "../../components/LogTerminal";
import { useRunStore } from "../../stores/useRunStore";
import type { RunReport } from "../../types/report";
import type { StepResult } from "../../types/run";
import { toScreenshotUrl } from "../../utils/artifact-url";
import { formatDuration, formatTime } from "../../utils/format";

type ViewMode = "overview" | "html" | "json" | "screenshots" | "logs";

export default function ReportViewer() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const { runId: latestRunId, run, setSummary } = useRunStore();
  const runId = params.runId === "latest" ? latestRunId : params.runId;
  const [report, setReport] = useState<RunReport>();
  const [mode, setMode] = useState<ViewMode>(() => readViewMode(searchParams.get("mode")));
  const [logs, setLogs] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<{ title: string; src: string }>();

  useEffect(() => {
    setMode(readViewMode(searchParams.get("mode")));
  }, [searchParams]);

  useEffect(() => {
    if (!runId) return;
    getTestRun(runId).then(setSummary).catch(() => undefined);
    getTestRunReport(runId)
      .then(setReport)
      .catch((error) => messageApi.warning(error instanceof Error ? error.message : String(error)));
    getTestRunLogs(runId).then(setLogs).catch(() => undefined);
  }, [messageApi, runId, setSummary]);

  if (!runId) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <PageHeader title="报告查看" description="暂无运行记录，请先执行用例。" />
        <Empty description="没有可查看的报告" />
      </div>
    );
  }

  const failedScreenshots = (report?.steps ?? run?.steps ?? []).filter((step) => step.screenshot);
  const summary = report ?? run;
  const steps = report?.steps ?? run?.steps ?? [];
  const failureSummary = report?.failureSummary;

  function changeMode(nextMode: ViewMode) {
    setMode(nextMode);
    setSearchParams(nextMode === "overview" ? {} : { mode: nextMode }, { replace: true });
  }

  async function copyText(text: string, successMessage: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    messageApi.success(successMessage);
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      {contextHolder}
      <PageHeader
        title="报告查看"
        description={runId}
        extra={
          <Segmented<ViewMode>
            value={mode}
            options={[
              { label: "概览", value: "overview" },
              { label: "HTML", value: "html" },
              { label: "JSON", value: "json" },
              { label: "截图", value: "screenshots" },
              { label: "日志", value: "logs" }
            ]}
            onChange={changeMode}
          />
        }
      />
      <Card title="报告入口" className="[&_.ant-card-body]:py-4">
        <Space wrap>
          <Button icon={<FileTextOutlined />} type={mode === "overview" ? "primary" : "default"} onClick={() => changeMode("overview")}>
            概览
          </Button>
          <Button icon={<FileTextOutlined />} type={mode === "html" ? "primary" : "default"} disabled={!run?.reportLinks.html} onClick={() => changeMode("html")}>
            HTML 预览
          </Button>
          <Button icon={<FileTextOutlined />} type={mode === "json" ? "primary" : "default"} disabled={!report} onClick={() => changeMode("json")}>
            JSON 数据
          </Button>
          <Button icon={<FolderOpenOutlined />} type={mode === "screenshots" ? "primary" : "default"} disabled={!failedScreenshots.length} onClick={() => changeMode("screenshots")}>
            失败截图
          </Button>
          <Button icon={<FileTextOutlined />} type={mode === "logs" ? "primary" : "default"} disabled={!logs} onClick={() => changeMode("logs")}>
            运行日志
          </Button>
          <Button icon={<FolderOpenOutlined />} disabled onClick={() => messageApi.info("Trace 在线预览暂未接入，请从本地产物目录查看。")}>
            Trace
          </Button>
        </Space>
      </Card>
      <Card className="[&_.ant-card-body]:p-3">
        {mode === "overview" ? (
          summary ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="m-0 truncate text-2xl font-semibold text-slate-950">{summary.caseName ?? summary.caseId}</h2>
                    <p className="mt-2 break-all text-sm text-slate-500">
                      runId: {summary.runId} · env: {summary.env}
                    </p>
                  </div>
                  <Tag color={summary.status === "passed" ? "success" : summary.status === "failed" ? "error" : "processing"}>{summary.status}</Tag>
                </div>
                <Row gutter={[12, 12]}>
                  <Col xs={12} xl={6}>
                    <Statistic title="总步骤" value={summary.total} />
                  </Col>
                  <Col xs={12} xl={6}>
                    <Statistic title="成功" value={summary.passed} valueStyle={{ color: "#16a34a" }} />
                  </Col>
                  <Col xs={12} xl={6}>
                    <Statistic title="失败" value={summary.failed} valueStyle={{ color: summary.failed ? "#dc2626" : undefined }} />
                  </Col>
                  <Col xs={12} xl={6}>
                    <Statistic title="跳过" value={summary.skipped} />
                  </Col>
                </Row>
              </div>
              {failureSummary ? (
                <Alert type="error" showIcon message="失败摘要" description={failureSummary} />
              ) : null}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Table<StepResult>
                  rowKey="stepId"
                  dataSource={steps}
                  pagination={false}
                  size="middle"
                  tableLayout="fixed"
                  scroll={{ x: 1320 }}
                  className="report-step-table"
                  columns={[
                    {
                      title: "#",
                      width: 54,
                      align: "center",
                      render: (_, record, index) => (
                        <span className={stepIndexClass(record.status)}>{index + 1}</span>
                      )
                    },
                    {
                      title: "步骤",
                      dataIndex: "stepId",
                      width: 230,
                      render: (stepId: string, record) => (
                        <div className="min-w-0">
                          <Typography.Text className="!block !font-medium !text-slate-950" ellipsis={{ tooltip: record.name }}>
                            {record.name}
                          </Typography.Text>
                          <Typography.Text className="!block !font-mono !text-xs !text-slate-500" ellipsis={{ tooltip: stepId }}>
                            {stepId}
                          </Typography.Text>
                        </div>
                      )
                    },
                    {
                      title: "类型",
                      dataIndex: "type",
                      width: 160,
                      render: (type: string) => <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{type}</code>
                    },
                    {
                      title: "会话",
                      dataIndex: "session",
                      width: 100,
                      render: (value) => value ? <Tag>{value}</Tag> : <span className="text-slate-400">-</span>
                    },
                    {
                      title: "状态",
                      dataIndex: "status",
                      width: 120,
                      render: (status) => <StepStatusBadge status={status} />
                    },
                    {
                      title: "耗时",
                      dataIndex: "durationMs",
                      width: 110,
                      render: (value) => <span className="font-mono text-sm text-slate-700">{formatDuration(value)}</span>
                    },
                    {
                      title: "数据",
                      dataIndex: "data",
                      width: 160,
                      render: (value?: unknown) => renderStepData(value)
                    },
                    {
                      title: "错误",
                      dataIndex: "error",
                      render: (value?: string) =>
                        value ? (
                          <Tooltip title={value}>
                            <Typography.Text type="danger" ellipsis className="!block">
                              {value}
                            </Typography.Text>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )
                    }
                  ]}
                  rowClassName={(record) => `report-step-table__row report-step-table__row--${record.status}`}
                />
              </div>
            </div>
          ) : (
            <Empty description="报告数据尚未生成" />
          )
        ) : null}
        {mode === "html" ? (
          run?.reportLinks.html ? (
            <iframe title="HTML 报告" src={run.reportLinks.html} className="h-[calc(100vh-300px)] min-h-[420px] w-full rounded-lg border border-[#d8e0ec] bg-white 2xl:min-h-[520px]" />
          ) : (
            <Empty description="HTML 报告尚未生成" />
          )
        ) : null}
        {mode === "json" ? (
          report ? (
            <div className="relative overflow-hidden rounded-lg bg-slate-900">
              <Button
                size="small"
                icon={<CopyOutlined />}
                className="!absolute !right-3 !top-3 !z-10 !border-slate-600 !bg-slate-800 !text-slate-100 hover:!border-blue-400 hover:!bg-slate-700 hover:!text-white"
                onClick={() => void copyText(JSON.stringify(report, null, 2), "JSON 数据已复制")}
              >
                复制
              </Button>
              <pre className="m-0 min-h-[420px] w-full overflow-auto whitespace-pre-wrap break-words p-3.5 pr-24 pt-12 font-mono text-xs leading-relaxed text-slate-300 2xl:min-h-[520px]">
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          ) : (
            <Alert type="info" showIcon message="JSON 报告尚未生成" />
          )
        ) : null}
        {mode === "screenshots" ? (
          <Table<StepResult>
            rowKey="stepId"
            dataSource={failedScreenshots}
            pagination={false}
            scroll={{ x: 760 }}
            columns={[
              { title: "步骤", dataIndex: "stepId" },
              { title: "名称", dataIndex: "name" },
              { title: "状态", dataIndex: "status", width: 100, render: (status) => <Tag color={status === "failed" ? "error" : "default"}>{status}</Tag> },
              { title: "开始时间", dataIndex: "startedAt", width: 120, render: formatTime },
              { title: "耗时", dataIndex: "durationMs", width: 100, render: formatDuration },
              {
                title: "截图",
                dataIndex: "screenshot",
                render: (href, record) =>
                  href ? (
                    <Button type="link" size="small" onClick={() => setScreenshotPreview({ title: record.stepId, src: toScreenshotUrl(href) })}>
                      打开
                    </Button>
                  ) : "-"
              }
            ]}
          />
        ) : null}
        {mode === "logs" ? <LogTerminal logs={logs} heightClassName="h-[560px]" /> : null}
      </Card>
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

function statusColor(status: string): string {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "processing";
  return "default";
}

function statusText(status: string): string {
  return ({ pending: "待执行", running: "执行中", passed: "成功", failed: "失败", skipped: "跳过" } as Record<string, string>)[status] ?? status;
}

function StepStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(status)}`} />
      {statusText(status)}
    </span>
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

function statusBadgeClass(status: string): string {
  if (status === "passed") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "running") return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  if (status === "skipped") return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return "bg-slate-50 text-slate-500 ring-1 ring-slate-200";
}

function statusDotClass(status: string): string {
  if (status === "passed") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  if (status === "running") return "bg-blue-500";
  return "bg-slate-400";
}

function stepIndexClass(status: string): string {
  const base = "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold";
  if (status === "passed") return `${base} bg-emerald-50 text-emerald-700`;
  if (status === "failed") return `${base} bg-red-50 text-red-700`;
  if (status === "running") return `${base} bg-blue-50 text-blue-700`;
  return `${base} bg-slate-100 text-slate-500`;
}

function readViewMode(mode: string | null): ViewMode {
  if (mode === "html" || mode === "json" || mode === "screenshots" || mode === "logs") return mode;
  return "overview";
}

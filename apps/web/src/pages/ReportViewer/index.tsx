import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Empty, Modal, Row, Segmented, Slider, Space, Statistic, Table, Tag, Typography, message } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MutedOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SoundOutlined
} from "@ant-design/icons";
import ReactPlayer from "react-player/HtmlPlayer";
import { useParams, useSearchParams } from "react-router-dom";
import { getTestRun, getTestRunLogs } from "../../api/testRuns";
import { getAiRunReport, getTestRunReport, listRunArtifactFiles } from "../../api/reports";
import { PageHeader } from "../../components/PageHeader";
import { LogTerminal } from "../../components/LogTerminal";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { TypewriterMarkdownViewer } from "../../components/TypewriterMarkdownViewer";
import { SCREENSHOT_PREVIEW_MAX_HEIGHT_CLASS, SCREENSHOT_PREVIEW_MODAL_WIDTH } from "../../components/image-preview";
import { useRunStore } from "../../stores/useRunStore";
import type { AiAnalysisRecord, AiRunReport, DeveloperHandoffSummary, RunReport } from "../../types/report";
import type { ArtifactFile } from "../../types/report";
import type { StepResult } from "../../types/run";
import { toArtifactUrl, toScreenshotUrl } from "../../utils/artifact-url";
import { formatDuration, formatTime } from "../../utils/format";
import { readReportViewMode, type ReportViewMode } from "./report-view-mode";
import { clampVideoTime, formatVideoTime, resolveVideoSliderValue } from "./video-player";

interface DetailPreview {
  title: string;
  content: string;
  danger?: boolean;
}

export default function ReportViewer() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const { run, setSummary, reset } = useRunStore();
  const runId = params.runId === "latest" ? "latest" : params.runId;
  const [report, setReport] = useState<RunReport>();
  const [aiReport, setAiReport] = useState<AiRunReport | null>(null);
  const [mode, setMode] = useState<ReportViewMode>(() => readReportViewMode(searchParams.get("mode")));
  const [logs, setLogs] = useState("");
  const [traceFiles, setTraceFiles] = useState<ArtifactFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<ArtifactFile[]>([]);
  const [screenshotPreview, setScreenshotPreview] = useState<{ title: string; src: string }>();
  const [videoPreview, setVideoPreview] = useState<{ title: string; src: string }>();
  const [detailPreview, setDetailPreview] = useState<DetailPreview>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSeeking, setVideoSeeking] = useState(false);
  const [videoSeekTime, setVideoSeekTime] = useState(0);
  const [videoMuted, setVideoMuted] = useState(false);
  const [latestMissing, setLatestMissing] = useState(false);
  const fullJson = useMemo(() => (report ? JSON.stringify(report, null, 2) : ""), [report]);
  const displayJson = useMemo(() => truncateMiddle(fullJson, 140_000), [fullJson]);

  useEffect(() => {
    setMode(readReportViewMode(searchParams.get("mode")));
  }, [searchParams]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoPreview) return;

    const playWhenReady = () => {
      void video
        .play()
        .then(() => setVideoPlaying(true))
        .catch(() => setVideoPlaying(false));
    };

    setVideoPlaying(false);
    setVideoCurrentTime(0);
    setVideoSeeking(false);
    setVideoSeekTime(0);
    setVideoDuration(0);
    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      playWhenReady();
      return;
    }

    video.addEventListener("loadeddata", playWhenReady, { once: true });
    return () => video.removeEventListener("loadeddata", playWhenReady);
  }, [videoPreview]);

  useEffect(() => {
    if (!runId) return;
    let canceled = false;
    setLatestMissing(false);
    setReport(undefined);
    setAiReport(null);
    setLogs("");
    setTraceFiles([]);
    setVideoFiles([]);

    async function loadReport() {
      try {
        const summary = await getTestRun(runId!);
        if (canceled) return;
        if (!summary) {
          reset();
          setReport(undefined);
          setLogs("");
          setVideoFiles([]);
          setLatestMissing(params.runId === "latest");
          return;
        }

        setSummary(summary);
        const [nextReport, nextAiReport, nextLogs, nextTraceFiles, nextVideoFiles] = await Promise.all([
          getTestRunReport(summary.runId).catch((error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            messageApi.warning(errorMessage);
            return null;
          }),
          getAiRunReport(summary.runId).catch(() => null),
          getTestRunLogs(summary.runId).catch(() => ""),
          listRunArtifactFiles("traces", summary.runId).catch(() => []),
          listRunArtifactFiles("videos", summary.runId).catch(() => [])
        ]);
        if (canceled) return;
        setReport(nextReport ?? undefined);
        setAiReport(nextAiReport);
        setLogs(nextLogs);
        setTraceFiles(nextTraceFiles);
        setVideoFiles(nextVideoFiles);
      } catch (error) {
        if (canceled) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (params.runId === "latest" && isNoHistoryError(errorMessage)) {
          reset();
          setReport(undefined);
          setLogs("");
          setLatestMissing(true);
          return;
        }
        messageApi.warning(errorMessage);
      }
    }

    void loadReport();
    return () => {
      canceled = true;
    };
  }, [messageApi, params.runId, reset, runId, setSummary]);

  if (!runId || latestMissing) {
    return (
      <div className="flex min-h-full flex-col gap-2.5">
        <PageHeader title="报告查看" description="暂无运行记录，请先执行用例。" />
        <Empty description="没有可查看的报告" />
      </div>
    );
  }

  const failedScreenshots = (report?.steps ?? run?.steps ?? []).filter((step) => step.screenshot);
  const traceSteps = (report?.steps ?? run?.steps ?? []).filter((step) => step.trace);
  const summary = report ?? run;
  const steps = report?.steps ?? run?.steps ?? [];
  const failureSummary = report?.failureSummary;
  const developerSummary = report?.developerSummary;
  const aiAnalyses = aiReport?.analyses ?? [];

  function changeMode(nextMode: ReportViewMode) {
    setMode(nextMode);
    setSearchParams(nextMode === "overview" ? {} : { mode: nextMode }, { replace: true });
  }

  async function copyText(text: string, successMessage: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    messageApi.success(successMessage);
  }

  function openDetail(title: string, content: string, danger = false) {
    setDetailPreview({ title, content, danger });
  }

  function closeVideoPreview() {
    videoRef.current?.pause();
    setVideoPreview(undefined);
    setVideoPlaying(false);
  }

  function toggleVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video
        .play()
        .then(() => setVideoPlaying(true))
        .catch(() => setVideoPlaying(false));
      return;
    }
    video.pause();
    setVideoPlaying(false);
  }

  function handleVideoLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setVideoMuted(video.muted);
  }

  function handleVideoSeekChange(value: number | number[]) {
    const nextTime = clampVideoTime(sliderValueToNumber(value), videoDuration);
    setVideoSeeking(true);
    setVideoSeekTime(nextTime);
  }

  function handleVideoSeekComplete(value: number | number[]) {
    const video = videoRef.current;
    const nextTime = clampVideoTime(sliderValueToNumber(value), videoDuration);
    if (video) {
      video.currentTime = nextTime;
    }
    setVideoCurrentTime(nextTime);
    setVideoSeekTime(nextTime);
    setVideoSeeking(false);
  }

  function toggleVideoMuted() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setVideoMuted(video.muted);
  }

  return (
    <div className="report-viewer flex min-h-full min-w-0 flex-col gap-2.5">
      {contextHolder}
      <PageHeader
        title="报告查看"
        description={summary?.runId ?? runId}
        extra={
          <Segmented<ReportViewMode>
            value={mode}
            options={[
              { label: "概览", value: "overview" },
              { label: "HTML", value: "html" },
              { label: "JSON", value: "json" },
              { label: "截图", value: "screenshots" },
              { label: "AI 分析", value: "ai-analysis" },
              { label: "日志", value: "logs" },
              { label: "Trace", value: "traces" },
              { label: "视频", value: "videos" }
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
          <Button icon={<RobotOutlined />} type={mode === "ai-analysis" ? "primary" : "default"} disabled={!aiAnalyses.length} onClick={() => changeMode("ai-analysis")}>
            AI 分析
          </Button>
          <Button icon={<FileTextOutlined />} type={mode === "logs" ? "primary" : "default"} disabled={!logs} onClick={() => changeMode("logs")}>
            运行日志
          </Button>
          <Button icon={<FolderOpenOutlined />} type={mode === "traces" ? "primary" : "default"} disabled={!traceSteps.length && !traceFiles.length} onClick={() => changeMode("traces")}>
            Trace
          </Button>
          <Button icon={<FolderOpenOutlined />} type={mode === "videos" ? "primary" : "default"} disabled={!videoFiles.length} onClick={() => changeMode("videos")}>
            视频
          </Button>
        </Space>
      </Card>
      <Card className="[&_.ant-card-body]:p-3">
        {mode === "overview" ? (
          summary ? (
            <div className="space-y-2.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
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
                    <Statistic title="成功" value={summary.passed} styles={{ content: { color: "#16a34a" } }} />
                  </Col>
                  <Col xs={12} xl={6}>
                    <Statistic title="失败" value={summary.failed} styles={{ content: { color: summary.failed ? "#dc2626" : undefined } }} />
                  </Col>
                  <Col xs={12} xl={6}>
                    <Statistic title="跳过" value={summary.skipped} />
                  </Col>
                </Row>
              </div>
              <div className="grid min-w-0 gap-[10px]">
                {developerSummary ? (
                  <DeveloperSummaryCard
                    summary={developerSummary}
                    onCopy={(content) => void copyText(content, "开发处理摘要已复制")}
                    onOpenDetail={openDetail}
                    onPreviewScreenshot={(title, src) => setScreenshotPreview({ title, src })}
                  />
                ) : null}
                {failureSummary ? (
                  <Alert
                    type="error"
                    showIcon
                    title="失败摘要"
                    description={<span className="report-viewer__long-text block">{failureSummary}</span>}
                  />
                ) : null}
                <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                      render: (value: unknown | undefined, record) =>
                        renderDetailCell({
                          content: formatDetailContent(value),
                          empty: value === undefined,
                          onOpen: () => openDetail(`步骤数据：${record.stepId}`, formatDetailContent(value))
                        })
                    },
                    {
                      title: "错误",
                      dataIndex: "error",
                      render: (value: string | undefined, record) =>
                        renderDetailCell({
                          content: value ?? "",
                          empty: !value,
                          danger: true,
                          onOpen: () => openDetail(`错误详情：${record.stepId}`, value ?? "", true)
                        })
                    }
                    ]}
                    rowClassName={(record) => `report-step-table__row report-step-table__row--${record.status}`}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Empty description="报告数据尚未生成" />
          )
        ) : null}
        {mode === "html" ? (
          run?.reportLinks.html ? (
            <iframe title="HTML 报告" src={toArtifactUrl(run.reportLinks.html)} className="h-[calc(100vh-300px)] min-h-[420px] w-full rounded-lg border border-[#d8e0ec] bg-white 2xl:min-h-[520px]" />
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
                onClick={() => void copyText(fullJson, "JSON 数据已复制")}
              >
                复制
              </Button>
              <pre className="m-0 min-h-[420px] w-full overflow-auto whitespace-pre-wrap break-words p-3.5 pr-24 pt-12 font-mono text-xs leading-relaxed text-slate-300 2xl:min-h-[520px]">
                {displayJson}
              </pre>
            </div>
          ) : (
            <Alert type="info" showIcon title="JSON 报告尚未生成" />
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
        {mode === "ai-analysis" ? (
          aiAnalyses.length ? (
            <div className="grid gap-2.5">
              {aiAnalyses.map((analysis) => (
                <AiAnalysisPanel
                  key={`${analysis.stepId}-${analysis.source}`}
                  analysis={analysis}
                  onCopy={(content) => void copyText(content, "AI 分析已复制")}
                  onPreviewScreenshot={(title, src) => setScreenshotPreview({ title, src })}
                />
              ))}
            </div>
          ) : (
            <Empty description="暂无 AI 分析报告" />
          )
        ) : null}
        {mode === "traces" ? traceSteps.length ? (
          <Table<StepResult>
            rowKey="stepId"
            dataSource={traceSteps}
            pagination={false}
            scroll={{ x: 760 }}
            columns={[
              { title: "步骤", dataIndex: "stepId" },
              { title: "名称", dataIndex: "name" },
              { title: "状态", dataIndex: "status", width: 100, render: (status) => <Tag color={status === "failed" ? "error" : "default"}>{status}</Tag> },
              { title: "开始时间", dataIndex: "startedAt", width: 120, render: formatTime },
              { title: "耗时", dataIndex: "durationMs", width: 100, render: formatDuration },
              {
                title: "Trace",
                dataIndex: "trace",
                render: (href) =>
                  href ? (
                    <Typography.Text className="!font-mono !text-xs" copyable={{ text: href }}>
                      {href}
                    </Typography.Text>
                  ) : "-"
              }
            ]}
          />
        ) : (
          <Table<ArtifactFile>
            rowKey="path"
            dataSource={traceFiles}
            pagination={false}
            scroll={{ x: 760 }}
            columns={[
              { title: "文件名", dataIndex: "name" },
              { title: "大小", dataIndex: "sizeBytes", width: 120, render: formatBytes },
              {
                title: "Trace",
                dataIndex: "path",
                render: (href) => (
                  <Button type="link" size="small" href={toArtifactUrl(href)} target="_blank" rel="noreferrer">
                    打开
                  </Button>
                )
              }
            ]}
          />
        ) : null}
        {mode === "videos" ? (
          videoFiles.length ? (
            <Table<ArtifactFile>
              rowKey="path"
              dataSource={videoFiles}
              pagination={false}
              scroll={{ x: 760 }}
              columns={[
                { title: "文件名", dataIndex: "name" },
                { title: "大小", dataIndex: "sizeBytes", width: 120, render: formatBytes },
                {
                  title: "视频",
                  dataIndex: "path",
                  render: (href, record) => (
                    <Button type="link" size="small" onClick={() => setVideoPreview({ title: record.name, src: toArtifactUrl(href) ?? href })}>
                      打开
                    </Button>
                  )
                }
              ]}
            />
          ) : (
            <Empty description="暂无视频文件" />
          )
        ) : null}
        {mode === "logs" ? <LogTerminal logs={logs} heightClassName="h-[560px]" /> : null}
      </Card>
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
        title={videoPreview ? `运行视频：${videoPreview.title}` : "运行视频"}
        open={Boolean(videoPreview)}
        width="86vw"
        footer={null}
        destroyOnHidden
        onCancel={closeVideoPreview}
      >
        {videoPreview ? (
          <div className="overflow-hidden rounded-lg bg-black">
            <div className="flex max-h-[70vh] items-center justify-center bg-black">
              <ReactPlayer
                ref={videoRef}
                src={videoPreview.src}
                muted={videoMuted}
                controls={false}
                autoPlay
                playsInline
                width="100%"
                height="100%"
                preload="metadata"
                className="max-h-[70vh] max-w-full bg-black object-contain [&_video]:max-h-[70vh] [&_video]:w-full [&_video]:object-contain"
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={(event) => {
                  if (!videoSeeking) {
                    setVideoCurrentTime(event.currentTarget.currentTime);
                  }
                }}
                onPlaying={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onEnded={() => setVideoPlaying(false)}
                onVolumeChange={(event) => setVideoMuted(event.currentTarget.muted)}
              />
            </div>
            <div className="flex items-center gap-3 border-t border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              <Button
                size="small"
                type="text"
                icon={videoPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                className="!text-slate-100 hover:!bg-slate-800 hover:!text-white"
                onClick={toggleVideoPlayback}
              />
              <span className="w-[88px] shrink-0 font-mono tabular-nums text-slate-300">
                {formatVideoTime(videoCurrentTime)} / {formatVideoTime(videoDuration)}
              </span>
              <Slider
                aria-label="视频进度"
                min={0}
                max={Math.max(videoDuration, 0)}
                step={0.1}
                value={resolveVideoSliderValue({ currentTime: videoCurrentTime, seekTime: videoSeekTime, seeking: videoSeeking, duration: videoDuration })}
                tooltip={{ formatter: (value) => formatVideoTime(value ?? 0) }}
                className="!m-0 min-w-0 flex-1"
                onChange={handleVideoSeekChange}
                onChangeComplete={handleVideoSeekComplete}
              />
              <Button
                size="small"
                type="text"
                icon={videoMuted ? <MutedOutlined /> : <SoundOutlined />}
                className="!text-slate-100 hover:!bg-slate-800 hover:!text-white"
                onClick={toggleVideoMuted}
              />
            </div>
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

function AiAnalysisPanel({
  analysis,
  onCopy,
  onPreviewScreenshot
}: {
  analysis: AiAnalysisRecord;
  onCopy: (content: string) => void;
  onPreviewScreenshot: (title: string, src: string) => void;
}) {
  const title = analysis.stepName ? `${analysis.stepName} / ${analysis.stepId}` : analysis.stepId;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RobotOutlined className="text-blue-600" />
            <Typography.Text strong className="!text-base">{title}</Typography.Text>
            <Tag color={analysis.source === "auto_failure" ? "blue" : "purple"}>{analysisSourceText(analysis.source)}</Tag>
            <Tag color={analysis.status === "completed" ? "success" : "error"}>{analysis.status === "completed" ? "已完成" : "失败"}</Tag>
          </div>
          <Typography.Text type="secondary" className="!mt-1 !block !text-xs">
            {analysis.generatedAt ? `生成时间：${formatTime(analysis.generatedAt)}` : ""}
          </Typography.Text>
        </div>
        <Space>
          {analysis.screenshot ? (
            <Button size="small" onClick={() => onPreviewScreenshot(analysis.stepId, toScreenshotUrl(analysis.screenshot!))}>
              查看截图
            </Button>
          ) : null}
          <Button size="small" icon={<CopyOutlined />} disabled={!analysis.content} onClick={() => onCopy(analysis.content ?? "")}>
            复制
          </Button>
        </Space>
      </div>
      {analysis.status === "completed" && analysis.content ? (
        <TypewriterMarkdownViewer
          content={analysis.content}
          className="max-h-[420px] min-h-[180px] overflow-auto rounded-lg bg-slate-950 p-4"
          onCopyCode={onCopy}
        />
      ) : (
        <Alert type="warning" showIcon title="AI 分析失败" description={analysis.error ?? "未返回分析结果"} />
      )}
    </div>
  );
}

function analysisSourceText(source: AiAnalysisRecord["source"]): string {
  return source === "auto_failure" ? "自动失败分析" : "手动截图分析";
}

function DeveloperSummaryCard({
  summary,
  onCopy,
  onOpenDetail,
  onPreviewScreenshot
}: {
  summary: DeveloperHandoffSummary;
  onCopy: (content: string) => void;
  onOpenDetail: (title: string, content: string, danger?: boolean) => void;
  onPreviewScreenshot: (title: string, src: string) => void;
}) {
  const copyText = [
    "开发处理摘要",
    `归因建议：${summary.title}`,
    `建议处理人：${ownerHintText(summary.ownerHint)}`,
    `失败步骤：${summary.failedStepId} / ${summary.failedStepName} / ${summary.failedStepType}`,
    `建议动作：${summary.suggestedAction}`,
    "",
    "关键证据：",
    ...summary.evidence.map((item) => `- ${item}`),
    "",
    "复现方式：",
    ...summary.reproduce.map((item) => `- ${item}`)
  ].join("\n");
  return (
    <div className="report-viewer__developer-summary rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Text strong className="!text-base">开发处理摘要</Typography.Text>
            <Tag color={ownerHintColor(summary.ownerHint)}>{ownerHintText(summary.ownerHint)}</Tag>
            <Tag>{categoryText(summary.category)}</Tag>
          </div>
          <Typography.Text className="report-viewer__long-text !mt-1 !block !text-slate-700">{summary.title}</Typography.Text>
        </div>
        <Space>
          {summary.relatedArtifacts.screenshot ? (
            <Button size="small" onClick={() => onPreviewScreenshot(summary.failedStepId, toScreenshotUrl(summary.relatedArtifacts.screenshot!))}>
              查看截图
            </Button>
          ) : null}
          <Button size="small" icon={<CopyOutlined />} onClick={() => onCopy(copyText)}>
            复制摘要
          </Button>
        </Space>
      </div>
      <Row gutter={[10, 10]}>
        <Col xs={24} xl={12} className="min-w-0">
          <div className="h-full rounded-md border border-blue-100 bg-white p-3">
            <Typography.Text strong>关键证据</Typography.Text>
            <ul className="mb-0 mt-2 space-y-1 pl-5 text-sm text-slate-700">
              {summary.evidence.map((item, index) => <li className="report-viewer__long-text" key={`${item}-${index}`}>{item}</li>)}
            </ul>
          </div>
        </Col>
        <Col xs={24} xl={12} className="min-w-0">
          <div className="h-full rounded-md border border-blue-100 bg-white p-3">
            <Typography.Text strong>复现与建议</Typography.Text>
            <ul className="mb-2 mt-2 space-y-1 pl-5 text-sm text-slate-700">
              {summary.reproduce.map((item, index) => <li className="report-viewer__long-text" key={`${item}-${index}`}>{item}</li>)}
            </ul>
            <Typography.Paragraph className="report-viewer__long-text !mb-0 !text-sm !text-slate-700">{summary.suggestedAction}</Typography.Paragraph>
          </div>
        </Col>
      </Row>
      <div className="mt-3 flex flex-wrap gap-2">
        {summary.relatedArtifacts.log ? <Button size="small" onClick={() => onOpenDetail("日志文件", summary.relatedArtifacts.log ?? "")}>日志路径</Button> : null}
        {summary.relatedArtifacts.trace ? <Button size="small" onClick={() => onOpenDetail("Trace 文件", summary.relatedArtifacts.trace ?? "")}>Trace 路径</Button> : null}
        {summary.relatedArtifacts.jsonReport ? <Button size="small" onClick={() => onOpenDetail("JSON 报告", summary.relatedArtifacts.jsonReport ?? "")}>JSON 路径</Button> : null}
      </div>
    </div>
  );
}

function ownerHintText(owner: DeveloperHandoffSummary["ownerHint"]): string {
  return ({ frontend: "前端开发", backend: "后端开发", test: "测试/自动化", environment: "环境/数据负责人", unknown: "待确认" } as Record<DeveloperHandoffSummary["ownerHint"], string>)[owner];
}

function ownerHintColor(owner: DeveloperHandoffSummary["ownerHint"]): string {
  return ({ frontend: "cyan", backend: "geekblue", test: "purple", environment: "orange", unknown: "default" } as Record<DeveloperHandoffSummary["ownerHint"], string>)[owner];
}

function categoryText(category: DeveloperHandoffSummary["category"]): string {
  return ({
    api_business_failure: "接口/业务返回",
    locator_or_ui_change: "页面/定位",
    assertion_failure: "断言",
    environment_or_data: "环境/数据",
    automation_runtime: "运行器",
    unknown: "待确认"
  } as Record<DeveloperHandoffSummary["category"], string>)[category];
}

function renderDetailCell(props: { content: string; empty: boolean; danger?: boolean; onOpen: () => void }) {
  if (props.empty) {
    return <span className="text-slate-400">-</span>;
  }
  const preview = compactPreview(props.content);
  return (
    <button
      type="button"
      className={`flex max-w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-xs cursor-pointer ${
        props.danger ? "text-red-500" : "text-slate-600"
      }`}
      onClick={props.onOpen}
    >
      <Typography.Text className={`!max-w-[240px] !font-mono !text-xs ${props.danger ? "!text-red-500" : "!text-slate-600"}`} ellipsis>
        {preview}
      </Typography.Text>
      <span className="shrink-0 text-blue-600">详情</span>
    </button>
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

function truncateMiddle(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  const keep = Math.floor((maxChars - 120) / 2);
  return [
    content.slice(0, keep),
    "",
    `... 内容较大，中间部分已省略，仅用于页面预览。复制按钮仍会复制完整 JSON。原始长度：${content.length.toLocaleString()} 字符 ...`,
    "",
    content.slice(-keep)
  ].join("\n");
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function sliderValueToNumber(value: number | number[]): number {
  return Array.isArray(value) ? value[0] ?? 0 : value;
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

function isNoHistoryError(message: string): boolean {
  return message.includes("暂无历史运行记录");
}

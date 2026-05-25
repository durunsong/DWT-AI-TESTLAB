import { useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Col, Empty, Input, Popconfirm, Row, Select, Space, Statistic, Table, Tag, message } from "antd";
import { ClearOutlined, DeleteOutlined, FileTextOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { clearArtifacts, deleteRunHistory, getArtifactSummaries, listRunHistory } from "../../api/reports";
import { PageHeader } from "../../components/PageHeader";
import type { ArtifactKind, ArtifactSummary, RunHistoryItem } from "../../types/report";
import { formatDuration, formatTime } from "../../utils/format";

const artifactOptions: Array<{ label: string; value: ArtifactKind }> = [
  { label: "日志", value: "logs" },
  { label: "截图", value: "screenshots" },
  { label: "报告", value: "reports" },
  { label: "Trace", value: "traces" },
  { label: "视频", value: "videos" },
  { label: "AI 报告", value: "ai-reports" }
];

const statusOptions: Array<{ label: string; value: RunHistoryItem["status"] }> = [
  { label: "运行中", value: "running" },
  { label: "成功", value: "passed" },
  { label: "失败", value: "failed" }
];

export default function RunHistory() {
  const [messageApi, contextHolder] = message.useMessage();
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [selectedKinds, setSelectedKinds] = useState<ArtifactKind[]>(["logs", "screenshots", "reports", "traces", "videos", "ai-reports"]);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyStatus, setHistoryStatus] = useState<RunHistoryItem["status"]>();
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState("");

  async function refreshArtifacts() {
    setLoadingArtifacts(true);
    try {
      setArtifacts(await getArtifactSummaries());
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function refreshHistory() {
    setLoadingHistory(true);
    try {
      setHistory(await listRunHistory());
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function refreshAll() {
    await Promise.all([refreshArtifacts(), refreshHistory()]);
  }

  async function handleClearArtifacts(kinds = selectedKinds) {
    if (!kinds.length) {
      messageApi.warning("请选择要清理的产物类型");
      return;
    }
    setClearing(true);
    try {
      const result = await clearArtifacts(kinds);
      setArtifacts(result.remaining);
      await refreshHistory();
      messageApi.success("运行产物已清理");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setClearing(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    setDeletingRunId(runId);
    try {
      await deleteRunHistory(runId);
      await refreshAll();
      messageApi.success("历史记录已删除");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingRunId("");
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const totalSize = artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
  const totalCount = artifacts.reduce((sum, item) => sum + item.count, 0);
  const filteredHistory = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    return history.filter((item) => {
      const matchedKeyword = keyword
        ? [item.runId, item.caseName, item.caseId].some((value) => value?.toLowerCase().includes(keyword))
        : true;
      const matchedStatus = historyStatus ? item.status === historyStatus : true;
      return matchedKeyword && matchedStatus;
    });
  }, [history, historyKeyword, historyStatus]);

  return (
    <div className="flex min-h-full flex-col gap-2.5">
      {contextHolder}
      <PageHeader
        title="历史记录"
        description="查看历史测试记录，管理报告、日志、截图和 trace 等运行产物。"
        extra={
          <Button
            icon={<ReloadOutlined className={loadingArtifacts || loadingHistory ? "animate-spin" : undefined} />}
            disabled={loadingArtifacts || loadingHistory}
            onClick={() => void refreshAll()}
          >
            刷新
          </Button>
        }
      />
      <Card title="运行产物">
        <Row gutter={[10, 10]} className="mb-2.5">
          <Col xs={12} xl={6}>
            <Statistic title="历史运行" value={history.length} />
          </Col>
          <Col xs={12} xl={6}>
            <Statistic title="产物条目" value={totalCount} />
          </Col>
          <Col xs={12} xl={6}>
            <Statistic title="占用空间" value={formatBytes(totalSize)} />
          </Col>
          <Col xs={12} xl={6}>
            <Statistic title="目录数" value={artifacts.length} />
          </Col>
        </Row>
        <Table<ArtifactSummary>
          rowKey="kind"
          size="small"
          loading={loadingArtifacts}
          dataSource={artifacts}
          pagination={false}
          className="mb-2.5"
          columns={[
            { title: "类型", dataIndex: "kind", width: 120, render: (kind: ArtifactKind) => artifactLabel(kind) },
            { title: "目录", dataIndex: "path", render: (value: string) => <code className="text-xs text-slate-600">{value}</code> },
            { title: "条目", dataIndex: "count", width: 100 },
            { title: "大小", dataIndex: "sizeBytes", width: 120, render: formatBytes }
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox.Group
            options={artifactOptions}
            value={selectedKinds}
            onChange={(values) => setSelectedKinds(values as ArtifactKind[])}
          />
          <Space>
            <Popconfirm
              title="清理选中产物"
              description="将删除选中目录下的自动化运行产物，保留目录本身。"
              okText="清理"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: clearing }}
              onConfirm={() => handleClearArtifacts()}
            >
              <Button danger icon={<ClearOutlined />} loading={clearing}>
                清理选中
              </Button>
            </Popconfirm>
            <Popconfirm
              title="清理全部运行产物"
              description="将清空 logs、screenshots、reports、traces、videos 和 AI 报告。历史报告入口也会被清空。"
              okText="全部清理"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: clearing }}
              onConfirm={() => handleClearArtifacts(["logs", "screenshots", "reports", "traces", "videos", "ai-reports"])}
            >
              <Button danger type="primary" icon={<ClearOutlined />} loading={clearing}>
                全部清理
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>
      <Card
        className="[&_.ant-card-head-title]:!overflow-visible [&_.ant-card-head-title]:!whitespace-normal"
        title={
          <div className="run-history__titlebar flex flex-wrap items-center gap-4">
            <span className="shrink-0">历史测试记录</span>
            <div className="run-history__title-filters flex flex-wrap items-center gap-3">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索 runId / 用例"
                value={historyKeyword}
                onChange={(event) => setHistoryKeyword(event.target.value)}
                className="!w-[300px] !flex-none"
              />
              <Select
                allowClear
                placeholder="筛选状态"
                value={historyStatus}
                options={statusOptions}
                onChange={setHistoryStatus}
                className="!w-[140px] !flex-none"
              />
            </div>
          </div>
        }
      >
        <Table<RunHistoryItem>
          rowKey="runId"
          loading={loadingHistory}
          dataSource={filteredHistory}
          locale={{ emptyText: <Empty description={history.length ? "暂无匹配的历史测试记录" : "暂无历史测试记录"} /> }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1280 }}
          columns={[
            {
              title: "runId",
              dataIndex: "runId",
              width: 260,
              render: (runId: string) => <span className="font-mono text-xs text-slate-700">{runId}</span>
            },
            { title: "用例", dataIndex: "caseName", width: 220, render: (value: string, record) => value || record.caseId },
            { title: "环境", dataIndex: "env", width: 90, render: (value: string) => <Tag>{value}</Tag> },
            { title: "状态", dataIndex: "status", width: 100, render: (value) => <Tag color={statusColor(value)}>{value}</Tag> },
            {
              title: "建议处理人",
              width: 130,
              render: (_, record) => record.developerSummary ? <Tag color={ownerColor(record.developerSummary.ownerHint)}>{ownerLabel(record.developerSummary.ownerHint)}</Tag> : "-"
            },
            { title: "开始时间", dataIndex: "startedAt", width: 170, render: formatTime },
            { title: "耗时", dataIndex: "durationMs", width: 110, render: formatDuration },
            {
              title: "结果",
              width: 150,
              render: (_, record) => `${record.passed}/${record.failed}/${record.skipped}/${record.total}`
            },
            {
              title: "操作",
              width: 250,
              fixed: "right",
              render: (_, record) => (
                <Space size={8} className="whitespace-nowrap">
                  <Link to={`/reports/${record.runId}`}>
                    <Button size="small" icon={<FileTextOutlined />}>报告</Button>
                  </Link>
                  <Link to={`/reports/${record.runId}?mode=html`}>
                    <Button size="small">HTML</Button>
                  </Link>
                  <Popconfirm
                    title="删除历史记录"
                    description={`删除 ${record.runId} 对应的报告、日志、截图、trace、视频和 AI 报告？`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: deletingRunId === record.runId }}
                    onConfirm={() => handleDeleteRun(record.runId)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} loading={deletingRunId === record.runId}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}

function artifactLabel(kind: ArtifactKind): string {
  const labels: Record<ArtifactKind, string> = {
    logs: "日志",
    screenshots: "截图",
    reports: "报告",
    traces: "Trace",
    videos: "视频",
    "ai-reports": "AI 报告"
  };
  return labels[kind];
}

function ownerLabel(owner: NonNullable<RunHistoryItem["developerSummary"]>["ownerHint"]): string {
  return ({ frontend: "前端开发", backend: "后端开发", test: "测试/自动化", environment: "环境/数据", unknown: "待确认" } as Record<NonNullable<RunHistoryItem["developerSummary"]>["ownerHint"], string>)[owner];
}

function ownerColor(owner: NonNullable<RunHistoryItem["developerSummary"]>["ownerHint"]): string {
  return ({ frontend: "cyan", backend: "geekblue", test: "purple", environment: "orange", unknown: "default" } as Record<NonNullable<RunHistoryItem["developerSummary"]>["ownerHint"], string>)[owner];
}

function formatBytes(value?: number): string {
  const bytes = value ?? 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusColor(status: RunHistoryItem["status"]): string {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  return "processing";
}

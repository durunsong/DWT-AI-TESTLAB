import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Row, Select, Space, Statistic, Tabs, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { getAppContext, getDbHealth } from "../../api/context";
import { listCases } from "../../api/cases";
import { listCaseTypes } from "../../api/settings";
import { listRunHistory } from "../../api/reports";
import { createBatchTestRun, createTestRun, getTestRun, getTestRunLogs } from "../../api/testRuns";
import { EnvSelector } from "../../components/EnvSelector";
import { LogTerminal } from "../../components/LogTerminal";
import { PageHeader } from "../../components/PageHeader";
import { ReportLinks } from "../../components/ReportLinks";
import { RunButtonGroup } from "../../components/RunButtonGroup";
import { RunStatusCard } from "../../components/RunStatusCard";
import { appBrandName } from "../../config/brand";
import { useCaseStore } from "../../stores/useCaseStore";
import { useRunStore } from "../../stores/useRunStore";
import { useSettingStore } from "../../stores/useSettingStore";
import type { DbHealthResult, AppAuthSourceSummary, AppContextSummary, AppRouteNode } from "../../types/context";
import type { RunHistoryItem } from "../../types/report";
import type { CaseTypeConfig } from "../../types/settings";
import { dashboardLayoutClasses } from "./dashboard-layout";
import { buildQualityOverview } from "./quality-overview";

export default function Dashboard() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { cases, setCases } = useCaseStore();
  const { env, setEnv } = useSettingStore();
  const { run, logs, setSummary, setLogs, reset, setCurrentBatchId } = useRunStore();
  const [loadingCase, setLoadingCase] = useState("");
  const [caseTypes, setCaseTypes] = useState<CaseTypeConfig[]>([{ key: "uncategorized", label: "未分类", enabled: true, sort: 0 }]);
  const [selectedCaseType, setSelectedCaseType] = useState<string>();
  const [batchLoading, setBatchLoading] = useState(false);
  const [context, setContext] = useState<AppContextSummary>();
  const [dbHealth, setDbHealth] = useState<DbHealthResult>();
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const qualityOverview = useMemo(() => buildQualityOverview(cases, history), [cases, history]);

  useEffect(() => {
    listCases().then(setCases).catch((error) => messageApi.error(error.message));
    listCaseTypes().then(setCaseTypes).catch(() => setCaseTypes([{ key: "uncategorized", label: "未分类", enabled: true, sort: 0 }]));
    listRunHistory().then(setHistory).catch(() => undefined);
    getAppContext().then(setContext).catch(() => undefined);
    getDbHealth().then(setDbHealth).catch(() => undefined);
  }, [messageApi, setCases]);

  useEffect(() => {
    if (!run?.runId || logs.length) return;
    let canceled = false;

    getTestRunLogs(run.runId)
      .then((nextLogs) => {
        if (!canceled && nextLogs) {
          setLogs(nextLogs);
        }
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [logs.length, run?.runId, setLogs]);

  async function handleRun(caseId: string) {
    reset();
    setLoadingCase(caseId);
    try {
      const created = await createTestRun({ caseId, env });
      const nextRun = await getTestRun(created.runId);
      if (nextRun) {
        setSummary(nextRun);
      }
      navigate(`/runs/${created.runId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingCase("");
    }
  }

  async function handleRunCaseType() {
    if (!selectedCaseType) {
      messageApi.warning("请选择用例类型");
      return;
    }
    const caseIds = cases
      .filter((item) => item.valid !== false && item.caseType === selectedCaseType)
      .map((item) => item.caseId);
    if (!caseIds.length) {
      messageApi.warning("当前类型下没有可执行用例");
      return;
    }
    setBatchLoading(true);
    try {
      const created = await createBatchTestRun({ caseIds, env });
      setCurrentBatchId(created.batchId);
      navigate(`/runs/latest?batchId=${encodeURIComponent(created.batchId)}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className={dashboardLayoutClasses.page}>
      {contextHolder}
      <PageHeader
        title="运行工作台"
        description={`选择环境和业务流程，启动 ${appBrandName} 自动化测试。`}
        extra={<EnvSelector value={env} disabled={run?.status === "running"} onChange={setEnv} />}
      />

      <Row gutter={[10, 10]} className={dashboardLayoutClasses.row}>
        <Col xs={24} xl={15} xxl={16} className={dashboardLayoutClasses.leftColumn}>
          <Space orientation="vertical" size={10} className="w-full">
            <Card title="质量概览">
              <Row gutter={[10, 10]}>
                <Col span={6}>
                  <Statistic title="可执行用例" value={qualityOverview.runnableCases} suffix={`/ ${qualityOverview.totalCases}`} />
                </Col>
                <Col span={6}>
                  <Statistic title="近期待通过率" value={qualityOverview.passRateText} />
                </Col>
                <Col span={6}>
                  <Statistic title="失败运行" value={qualityOverview.failedRuns} styles={{ content: { color: qualityOverview.failedRuns ? "#dc2626" : undefined } }} />
                </Col>
                <Col span={6}>
                  <Statistic title="未验证用例" value={qualityOverview.unrunRunnableCases} />
                </Col>
              </Row>
              <Alert
                className="mt-2.5"
                type={qualityOverview.recommendationTone}
                showIcon
                title={qualityOverview.recommendation}
                description={qualityOverview.completedRuns ? `已纳入 ${qualityOverview.completedRuns} 次历史执行结果。` : "暂无历史运行结果，建议先执行核心冒烟用例。"}
              />
              {qualityOverview.topFailedCases.length ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
                  <Typography.Text type="secondary">失败 Top：</Typography.Text>
                  {qualityOverview.topFailedCases.map((item) => (
                    <Tag key={item.caseId} color="error" className="m-0">
                      {item.caseName} · {item.failures} 次
                    </Tag>
                  ))}
                </div>
              ) : null}
            </Card>
            <Card title="流程入口">
              <RunButtonGroup
                cases={cases}
                runningCaseId={loadingCase}
                disabled={run?.status === "running"}
                onRun={(caseId) => void handleRun(caseId)}
              />
            </Card>
            <Card title="按类型运行">
              <Space orientation="vertical" size={10} className="w-full">
                <Space>
                  <Select
                    className="w-[220px]"
                    placeholder="选择用例类型"
                    value={selectedCaseType}
                    options={caseTypes.filter((item) => item.enabled).map((item) => ({ label: item.label, value: item.key }))}
                    onChange={setSelectedCaseType}
                  />
                  <Button type="primary" loading={batchLoading} disabled={run?.status === "running"} onClick={() => void handleRunCaseType()}>
                    运行该类型
                  </Button>
                </Space>
              </Space>
            </Card>
            <RunStatusCard run={run} />
            <Card title="报告链接">
              <ReportLinks run={run} />
            </Card>
          </Space>
        </Col>
        <Col xs={24} xl={9} xxl={8} className={dashboardLayoutClasses.rightColumn}>
          <div className={dashboardLayoutClasses.rightStack}>
            <Alert
              className="shrink-0"
              type={dbHealth?.enabled ? "success" : "warning"}
              showIcon
              title="DB 连接"
              description={dbHealth ? `${dbHealth.enabled ? "已启用" : "未启用"} · ${dbHealth.message}` : "检测中"}
            />
            <Card
              title={`${appBrandName} 上下文`}
              className="h-[250px] shrink-0 overflow-hidden [&_.ant-card-body]:h-[186px] [&_.ant-card-body]:overflow-auto"
            >
              <Tabs
                size="small"
                items={buildContextTabs(context)}
              />
            </Card>
            <LogTerminal logs={logs} className="h-[620px] shrink-0" heightClassName="" />
          </div>
        </Col>
      </Row>
    </div>
  );
}

function buildContextTabs(context?: AppContextSummary) {
  const sources = context?.sources?.length ? context.sources : [context?.user, context?.admin].filter(Boolean) as AppAuthSourceSummary[];
  return sources.map((summary) => ({
    key: summary.source,
    label: summary.source,
    children: <RouteSummary summary={summary} routes={preferredRoutes(summary)} />
  }));
}

function preferredRoutes(summary: AppAuthSourceSummary): AppRouteNode[] {
  if (summary.source === "user" && summary.enterpriseRoutes.length) {
    return summary.enterpriseRoutes;
  }
  if (summary.source === "admin" && summary.approvalRoutes.length) {
    return summary.approvalRoutes;
  }
  return summary.routes;
}

function RouteSummary(props: { summary?: AppAuthSourceSummary; routes?: AppRouteNode[] }) {
  const routes = props.routes?.length ? props.routes : props.summary?.routes ?? [];
  const routeLabels = routes
    .slice(0, 6)
    .map((route) => route.title || route.fullPath || route.path || route.name)
    .filter(Boolean);

  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <strong>{props.summary?.routeCount ?? 0} 条路由</strong>
        {props.summary?.authFile ? <Tag className="m-0 max-w-[180px] truncate">{props.summary.authFile}</Tag> : null}
      </div>
      {props.summary?.routeSourceKey ? <span className="truncate text-xs text-[#8a95a6]">{props.summary.routeSourceKey}</span> : null}
      {routeLabels.length ? <span className="text-[#68758a] leading-6">{routeLabels.join(" / ")}</span> : null}
    </div>
  );
}

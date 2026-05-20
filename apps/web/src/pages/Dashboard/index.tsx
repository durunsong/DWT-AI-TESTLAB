import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Space, Tabs, message } from "antd";
import { useNavigate } from "react-router-dom";
import { getDbHealth, getDowaletContext } from "../../api/context";
import { listCases } from "../../api/cases";
import { createTestRun, getTestRun } from "../../api/testRuns";
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
import type { DbHealthResult, DowaletContextSummary } from "../../types/context";

export default function Dashboard() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { cases, setCases } = useCaseStore();
  const { env, setEnv } = useSettingStore();
  const { run, logs, setSummary, reset } = useRunStore();
  const [loadingCase, setLoadingCase] = useState("");
  const [context, setContext] = useState<DowaletContextSummary>();
  const [dbHealth, setDbHealth] = useState<DbHealthResult>();

  useEffect(() => {
    listCases().then(setCases).catch((error) => messageApi.error(error.message));
    getDowaletContext().then(setContext).catch(() => undefined);
    getDbHealth().then(setDbHealth).catch(() => undefined);
  }, [messageApi, setCases]);

  async function handleRun(caseId: string) {
    reset();
    setLoadingCase(caseId);
    try {
      const created = await createTestRun({ caseId, env });
      const nextRun = await getTestRun(created.runId);
      setSummary(nextRun);
      navigate(`/runs/${created.runId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingCase("");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {contextHolder}
      <PageHeader
        title="运行工作台"
        description={`选择环境和业务流程，启动 ${appBrandName} 自动化测试。`}
        extra={<EnvSelector value={env} disabled={run?.status === "running"} onChange={setEnv} />}
      />

      <Row gutter={[10, 10]} className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden">
        <Col xs={24} xl={15} xxl={16} className="min-h-0 overflow-visible pr-0 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
          <Space direction="vertical" size={10} className="w-full">
            <Card title="流程入口">
              <RunButtonGroup
                cases={cases}
                runningCaseId={loadingCase}
                disabled={run?.status === "running"}
                onRun={(caseId) => void handleRun(caseId)}
              />
            </Card>
            <RunStatusCard run={run} />
            <Card title="报告链接">
              <ReportLinks run={run} />
            </Card>
          </Space>
        </Col>
        <Col xs={24} xl={9} xxl={8} className="min-h-0 pr-0 xl:max-h-full xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
          <div className="flex min-h-0 flex-col gap-2.5 pb-1">
            <Alert
              className="shrink-0"
              type={dbHealth?.enabled ? "success" : "warning"}
              showIcon
              message="DB 连接"
              description={dbHealth ? `${dbHealth.enabled ? "已启用" : "未启用"} · ${dbHealth.message}` : "检测中"}
            />
            <Card
              title={`${appBrandName} 上下文`}
              className="h-[360px] shrink-0 overflow-hidden [&_.ant-card-body]:h-[296px] [&_.ant-card-body]:overflow-auto"
            >
              <Tabs
                size="small"
                items={[
                  {
                    key: "user",
                    label: "user",
                    children: <RouteSummary count={context?.user.routeCount} routes={context?.user.enterpriseRoutes.map((item) => item.title || item.path)} />
                  },
                  {
                    key: "admin",
                    label: "admin",
                    children: <RouteSummary count={context?.admin.routeCount} routes={context?.admin.approvalRoutes.map((item) => item.title || item.path)} />
                  }
                ]}
              />
            </Card>
            <LogTerminal logs={logs} className="h-[620px] shrink-0" heightClassName="" />
          </div>
        </Col>
      </Row>
    </div>
  );
}

function RouteSummary(props: { count?: number; routes?: string[] }) {
  return (
    <div className="grid gap-2">
      <strong>{props.count ?? 0} 条路由</strong>
      {(props.routes ?? []).slice(0, 6).map((route, index) => (
        <span key={`${route}-${index}`} className="truncate text-[#68758a]">
          {route}
        </span>
      ))}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  analyzeScreenshot,
  getDbHealth,
  getDowaletContext,
  getRunLogs,
  getTestRun,
  listCases,
  startTestRun,
  type CaseItem,
  type DbHealthResult,
  type DowaletContextSummary,
  type StepStatus,
  type TestRunSummary
} from "../api/test-runs";

const envOptions = ["local", "dev", "test", "sit"];
const statusFilters: Array<"all" | StepStatus> = ["all", "running", "passed", "failed", "skipped"];
const preferredCases = [
  "login_user",
  "login_admin",
  "kyc_submit",
  "kyc_submit_and_approve"
];

export function TestDashboard() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [env, setEnv] = useState("local");
  const [activeRunId, setActiveRunId] = useState("");
  const [run, setRun] = useState<TestRunSummary | undefined>();
  const [logs, setLogs] = useState("");
  const [dowaletContext, setDowaletContext] = useState<DowaletContextSummary | undefined>();
  const [dbHealth, setDbHealth] = useState<DbHealthResult | undefined>();
  const [filter, setFilter] = useState<"all" | StepStatus>("all");
  const [loadingCase, setLoadingCase] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoadingStep, setAiLoadingStep] = useState("");

  useEffect(() => {
    listCases().then(setCases).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    getDowaletContext().then(setDowaletContext).catch(() => undefined);
    getDbHealth().then(setDbHealth).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeRunId) return;
    const timer = window.setInterval(() => {
      getTestRun(activeRunId)
        .then((nextRun) => {
          setRun(nextRun);
          if (nextRun.status !== "running") {
            window.clearInterval(timer);
            getRunLogs(activeRunId).then(setLogs).catch(() => undefined);
          }
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeRunId]);

  const orderedCases = useMemo(() => {
    return [...cases].sort((a, b) => preferredCases.indexOf(a.caseId) - preferredCases.indexOf(b.caseId));
  }, [cases]);

  const filteredSteps = useMemo(() => {
    const steps = run?.steps ?? [];
    return filter === "all" ? steps : steps.filter((step) => step.status === filter);
  }, [filter, run?.steps]);

  const progress = run && run.total > 0 ? Math.round(((run.passed + run.failed + run.skipped) / run.total) * 100) : 0;

  async function handleStart(caseId: string) {
    setError("");
    setLogs("");
    setAiAnalysis("");
    setLoadingCase(caseId);
    try {
      const response = await startTestRun(caseId, env);
      setActiveRunId(response.runId);
      setRun(await getTestRun(response.runId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoadingCase("");
    }
  }

  async function handleCopyLogs() {
    if (!logs) return;
    await navigator.clipboard.writeText(logs);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleAnalyzeScreenshot(step: { stepId: string; screenshot?: string; error?: string }) {
    if (!step.screenshot) return;
    setToast("");
    setAiAnalysis("");
    setAiLoadingStep(step.stepId);
    try {
      const content = await analyzeScreenshot({
        screenshotPath: step.screenshot,
        stepId: step.stepId,
        error: step.error
      });
      setAiAnalysis(content);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAiLoadingStep("");
    }
  }

  const dbHealthTone = dbHealth?.enabled ? "ok" : "bad";

  return (
    <main className="dashboard">
      {toast ? (
        <div className="toast error" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <aside className="sidebar">
        <div>
          <p className="eyebrow">AI 自动化测试平台</p>
          <h1>测试运行工作台</h1>
        </div>

        <label className="field">
          <span>执行环境</span>
          <select value={env} onChange={(event) => setEnv(event.target.value)} disabled={run?.status === "running"}>
            {envOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <div className="case-list">
          {orderedCases.map((item) => (
            <button
              key={item.caseId}
              className="case-button"
              disabled={Boolean(loadingCase) || run?.status === "running"}
              onClick={() => void handleStart(item.caseId)}
              title={item.description}
            >
              <strong>{caseName(item.caseId, item.caseName)}</strong>
              <span>{item.total} steps · {item.mode}</span>
              {loadingCase === item.caseId ? <b>启动中</b> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className="main-panel">
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="summary-grid">
          <Summary label="当前 runId" value={run?.runId ?? "-"} />
          <Summary label="当前 caseId" value={run?.caseId ?? "-"} />
          <Summary label="当前步骤" value={run?.currentStep ?? "-"} />
          <Summary label="状态" value={run?.status ?? "-"} tone={run?.status} />
          <Summary label="成功 / 失败" value={`${run?.passed ?? 0} / ${run?.failed ?? 0}`} />
          <Summary label="总耗时" value={run?.durationMs ? `${run.durationMs}ms` : "-"} />
        </div>

        <div className="progress-wrap">
          <div className="progress-text">
            <span>进度</span>
            <b>{run ? `${run.passed + run.failed + run.skipped}/${run.total}` : "0/0"}</b>
          </div>
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="table-toolbar">
          <h2>步骤面板</h2>
          <div className="filters">
            {statusFilters.map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                {filterText(item)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>step_id</th>
                <th>名称</th>
                <th>类型</th>
                <th>会话</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>耗时</th>
                <th>错误摘要</th>
                <th>截图</th>
              </tr>
            </thead>
            <tbody>
              {filteredSteps.map((step, index) => (
                <tr key={step.stepId} className={step.stepId === run?.currentStep ? "current-row" : ""}>
                  <td>{index + 1}</td>
                  <td className="mono">{step.stepId}</td>
                  <td>{step.name}</td>
                  <td>{step.type}</td>
                  <td>{step.session ?? "-"}</td>
                  <td><span className={`status ${step.status}`}>{statusText(step.status)}</span></td>
                  <td>{step.startedAt ? new Date(step.startedAt).toLocaleTimeString() : "-"}</td>
                  <td>{step.durationMs ? `${step.durationMs}ms` : "-"}</td>
                  <td className="error-cell" title={step.error}>{step.error ?? "-"}</td>
                  <td>
                    {step.screenshot ? (
                      <div className="screenshot-actions">
                        <a href={step.screenshot} target="_blank" rel="noreferrer">查看</a>
                        <button
                          type="button"
                          onClick={() => void handleAnalyzeScreenshot(step)}
                          disabled={Boolean(aiLoadingStep)}
                        >
                          {aiLoadingStep === step.stepId ? "分析中" : "AI分析"}
                        </button>
                      </div>
                    ) : "-"}
                  </td>
                </tr>
              ))}
              {!filteredSteps.length ? (
                <tr><td colSpan={10} className="empty">暂无步骤数据</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="report-panel">
        <h2>Dowalet 上下文</h2>
        <div className="context-grid">
          <ContextBlock title="user 路由" count={dowaletContext?.user.routeCount} routes={dowaletContext?.user.enterpriseRoutes} />
          <ContextBlock title="admin 路由" count={dowaletContext?.admin.routeCount} routes={dowaletContext?.admin.approvalRoutes} />
        </div>
        <div className={`db-health ${dbHealthTone}`}>
          <strong>DB</strong>
          <span>{dbHealth ? `${dbHealth.enabled ? "已启用" : "未启用"} · ${dbHealth.message}` : "检测中"}</span>
          {dbHealth?.database ? <small>{dbHealth.database}</small> : null}
        </div>

        <div className="log-title-row">
          <h2>报告与日志</h2>
          <button className="icon-button" type="button" onClick={() => void handleCopyLogs()} disabled={!logs} title="复制日志" aria-label="复制日志">
            <CopyIcon />
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
        </div>
        <div className="link-list">
          <ReportLink label="JSON 报告" href={run?.reportLinks.json} />
          <ReportLink label="HTML 报告" href={run?.reportLinks.html} />
          <ReportLink label="截图目录" href={run?.reportLinks.screenshots} />
          <ReportLink label="trace 目录" href={run?.reportLinks.traces} />
          <ReportLink label="日志接口" href={run?.reportLinks.logs} />
        </div>
        <pre>{logs || "运行结束后展示日志内容。"}</pre>

        <div className="analysis-panel">
          <h2>AI 截图分析</h2>
          <pre>{aiAnalysis || "失败步骤有截图后，可点击步骤里的 AI分析。"}</pre>
        </div>
      </aside>
    </main>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function ContextBlock(props: { title: string; count?: number; routes?: Array<{ path: string; title?: string; perm?: string }> }) {
  return (
    <div className="context-block">
      <div><strong>{props.title}</strong><span>{props.count ?? 0} 条</span></div>
      {(props.routes ?? []).slice(0, 4).map((route) => (
        <p key={`${route.path}-${route.perm}`} title={`${route.title ?? ""} ${route.path}`}>
          {route.title || route.path}
        </p>
      ))}
    </div>
  );
}

function Summary(props: { label: string; value: string; tone?: string }) {
  return <div className={`summary ${props.tone ?? ""}`}><span>{props.label}</span><strong>{props.value}</strong></div>;
}

function ReportLink(props: { label: string; href?: string }) {
  return props.href ? <a href={props.href} target="_blank" rel="noreferrer">{props.label}</a> : <span>{props.label}</span>;
}

function caseName(caseId: string, fallback: string): string {
  const names: Record<string, string> = {
    login_user: "user 登录流程",
    login_admin: "admin 登录流程",
    kyc_submit: "KYC 提交流程",
    kyc_submit_and_approve: "KYC 提交 + admin 审核完整流程"
  };
  return names[caseId] ?? fallback;
}

function filterText(status: "all" | StepStatus): string {
  return ({ all: "全部", running: "执行中", passed: "成功", failed: "失败", skipped: "跳过", pending: "待执行" } as const)[status];
}

function statusText(status: StepStatus): string {
  return filterText(status);
}

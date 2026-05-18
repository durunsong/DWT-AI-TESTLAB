export interface CaseItem {
  caseId: string;
  caseName: string;
  description?: string;
  mode: string;
  total: number;
}

export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";
export type RunStatus = "queued" | "running" | "passed" | "failed";

export interface StepResult {
  stepId: string;
  name: string;
  type: string;
  session?: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
  screenshot?: string;
  trace?: string;
}

export interface TestRunSummary {
  runId: string;
  caseId: string;
  caseName?: string;
  env: string;
  status: RunStatus;
  currentStep?: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  steps: StepResult[];
  reportLinks: {
    json?: string;
    html?: string;
    logs?: string;
    screenshots?: string;
    traces?: string;
  };
}

export interface DowaletRouteNode {
  path: string;
  fullPath: string;
  name?: string;
  title?: string;
  component?: string;
  perm?: string;
  visible?: string;
  hidden?: boolean;
  menuType?: string;
  id?: string;
}

export interface DowaletAuthSourceSummary {
  source: "user" | "admin";
  authFile: string;
  profile: Record<string, unknown>;
  routeCount: number;
  visibleRouteCount: number;
  enterpriseRoutes: DowaletRouteNode[];
  approvalRoutes: DowaletRouteNode[];
}

export interface DowaletContextSummary {
  user: DowaletAuthSourceSummary;
  admin: DowaletAuthSourceSummary;
}

export interface DbHealthResult {
  enabled: boolean;
  ok: boolean;
  host?: string;
  port?: number;
  database?: string;
  message: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export async function listCases(): Promise<CaseItem[]> {
  return request<CaseItem[]>("/api/cases");
}

export async function startTestRun(caseId: string, env: string): Promise<{ runId: string; status: RunStatus }> {
  return request("/api/test-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseId, env })
  });
}

export async function getTestRun(runId: string): Promise<TestRunSummary> {
  return request<TestRunSummary>(`/api/test-runs/${runId}`);
}

export async function getRunLogs(runId: string): Promise<string> {
  return request<string>(`/api/test-runs/${runId}/logs`);
}

export async function getDowaletContext(): Promise<DowaletContextSummary> {
  return request<DowaletContextSummary>("/api/dowalet/context");
}

export async function getDbHealth(): Promise<DbHealthResult> {
  return request<DbHealthResult>("/api/db/health");
}

export async function analyzeScreenshot(input: { screenshotPath: string; stepId?: string; error?: string }): Promise<string> {
  return request<{ content: string }>("/api/ai/analyze-screenshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  }).then((result) => result.content);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
  return payload.data;
}

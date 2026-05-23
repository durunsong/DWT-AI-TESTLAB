import { maskSensitive, resolveVariables, type ApiExpectedValue, type ApiResponseDiagnostic, type RuntimeContextState, type ScenarioStep, type StepResult } from "@ai-e2e/shared";

type ApiScalar = string | number | boolean | null;
type ApiQuery = Record<string, ApiScalar>;
type JsonRecord = Record<string, unknown>;

export class ApiExecutor {
  constructor(
    private readonly input: {
      context: { state: RuntimeContextState; setVariable: (key: string, value: string) => void };
      fetch?: typeof fetch;
      now?: () => string;
      sessionCookieHeader?: (session: NonNullable<ScenarioStep["session"]>, url: string) => Promise<string | undefined>;
    }
  ) {}

  async execute(step: ScenarioStep): Promise<Partial<StepResult>> {
    if (step.type !== "api_request" && step.type !== "api_assert") {
      throw new Error(`API 执行器不支持步骤类型：${step.type}`);
    }
    if (!step.url) {
      throw new Error(`${step.type} 必须指定 url`);
    }

    const request = await this.buildRequest(step);
    const startedAt = this.now();
    const response = await (this.input.fetch ?? fetch)(request.url, request.init);
    const api = await this.readResponse(response, request.method, startedAt);

    this.assertStatus(step, api);
    this.assertBusinessCode(step, api);
    if (step.type === "api_assert") {
      this.assertExpected(step, api);
    }

    const variable = step.save_as || step.variable;
    if (variable) {
      this.input.context.setVariable(variable, this.variableValue(step, api));
    }

    return {
      message: variable ? `API 请求完成，已写入变量：${variable}` : `API 请求完成：${api.method} ${api.status}`,
      data: maskSensitive({
        request: {
          url: request.url,
          method: request.method,
          headers: request.reportHeaders,
          body: request.reportBody
        },
        response: api
      })
    };
  }

  private async buildRequest(step: ScenarioStep): Promise<{
    url: string;
    method: string;
    init: RequestInit;
    reportHeaders: Record<string, string>;
    reportBody?: unknown;
  }> {
    const method = (step.method ?? "GET").toUpperCase();
    const url = this.resolveUrl(step);
    const headers = this.resolveHeaders(step.headers);
    if (step.session && !headers.cookie) {
      const cookie = await this.input.sessionCookieHeader?.(step.session, url);
      if (cookie) {
        headers.cookie = cookie;
      }
    }
    const bodyValue = step.body ?? step.value;
    const body = bodyValue === undefined || method === "GET" || method === "HEAD"
      ? undefined
      : this.resolvePayload(bodyValue, step);

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      if (typeof body === "string") {
        init.body = body;
      } else {
        headers["content-type"] ??= "application/json";
        init.body = JSON.stringify(body);
      }
    }

    return {
      url,
      method,
      init,
      reportHeaders: headers,
      reportBody: body
    };
  }

  private resolveUrl(step: ScenarioStep): string {
    const rawUrl = resolveVariables(step.url, this.input.context.state, step);
    const baseUrl = this.baseUrl(step, rawUrl);
    const url = new URL(rawUrl, baseUrl);

    for (const [key, rawValue] of Object.entries((step.query ?? {}) as ApiQuery)) {
      if (rawValue === null) {
        continue;
      }
      const value = typeof rawValue === "string"
        ? resolveVariables(rawValue, this.input.context.state, step)
        : String(rawValue);
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private baseUrl(step: ScenarioStep, rawUrl: string): string | undefined {
    if (/^https?:\/\//i.test(rawUrl)) {
      return undefined;
    }

    const envBaseUrl = process.env.API_BASE_URL
      ?? process.env.APP_API_BASE_URL
      ?? process.env.DWT_API_BASE_URL
      ?? process.env.TEST_API_BASE_URL;
    if (envBaseUrl) {
      return envBaseUrl;
    }

    if (step.session) {
      const loginUrl = this.input.context.state.sessions[step.session]?.login_url;
      if (loginUrl) {
        return new URL(resolveVariables(loginUrl, this.input.context.state, step)).origin;
      }
    }

    throw new Error("相对 API URL 需要配置 API_BASE_URL，或在步骤中指定 session 以复用登录地址域名");
  }

  private resolveHeaders(headers: Record<string, string> | undefined): Record<string, string> {
    return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      resolveVariables(value, this.input.context.state)
    ]));
  }

  private resolvePayload(value: unknown, step: ScenarioStep): unknown {
    if (typeof value === "string") {
      return resolveVariables(value, this.input.context.state, step);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.resolvePayload(item, step));
    }
    if (isRecord(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.resolvePayload(item, step)]));
    }
    return value;
  }

  private async readResponse(response: Response, method: string, matchedAt: string): Promise<ApiResponseDiagnostic> {
    const bodyText = redactSensitiveText(truncateText(await response.text().catch(() => ""), 20_000));
    const bodyJson = parseJson(bodyText);
    return {
      url: response.url,
      method,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      failed: !response.ok,
      failureReason: response.ok ? undefined : `HTTP ${response.status}`,
      contentType: response.headers.get("content-type") ?? undefined,
      bodyText,
      bodyJson,
      matchedAt
    };
  }

  private assertStatus(step: ScenarioStep, api: ApiResponseDiagnostic): void {
    const expectedStatus = step.expected_status ?? 200;
    if (api.status !== expectedStatus) {
      throw apiAssertionError(`API 状态码不符合预期：期望 HTTP ${expectedStatus}，实际 HTTP ${api.status}，响应：${api.bodyText ?? "-"}`, api);
    }
  }

  private assertBusinessCode(step: ScenarioStep, api: ApiResponseDiagnostic): void {
    const businessCode = readConfiguredBusinessCode(api.bodyJson, step.business_code_path);
    if (businessCode === undefined) {
      return;
    }

    const failureCodes = step.failure_codes ?? apiBusinessConfig().failureCodes;
    if (failureCodes.some((code) => isExpectedApiValue(businessCode, code))) {
      throw apiAssertionError(`API 业务码为失败：${String(businessCode)}，响应：${api.bodyText ?? "-"}`, api);
    }

    const successCodes = step.success_codes ?? apiBusinessConfig().successCodes;
    if (successCodes.length && !successCodes.some((code) => isExpectedApiValue(businessCode, code))) {
      throw apiAssertionError(`API 业务码不符合预期：期望 ${successCodes.join("/")}，实际 ${String(businessCode)}，响应：${api.bodyText ?? "-"}`, api);
    }
  }

  private assertExpected(step: ScenarioStep, api: ApiResponseDiagnostic): void {
    if (step.expected === undefined) {
      return;
    }

    if (typeof step.expected === "string") {
      const expected = resolveVariables(step.expected, this.input.context.state, step);
      const actual = this.readBodyValue(step, api);
      if (!String(actual ?? "").includes(expected)) {
        throw apiAssertionError(`API 响应断言失败：响应内容不包含 ${expected}`, api);
      }
      return;
    }

    const body = api.bodyJson;
    for (const [pathExpression, rawExpected] of Object.entries(step.expected)) {
      const expected = typeof rawExpected === "string"
        ? resolveVariables(rawExpected, this.input.context.state, step)
        : rawExpected;
      const actual = readPath(body, pathExpression);
      if (!isExpectedApiValue(actual, expected)) {
        throw apiAssertionError(`API 响应断言失败：${pathExpression} 期望 ${String(expected)}，实际 ${String(actual)}`, api);
      }
    }
  }

  private variableValue(step: ScenarioStep, api: ApiResponseDiagnostic): string {
    const value = this.readBodyValue(step, api);
    if (typeof value === "string") {
      return value;
    }
    if (value === undefined || value === null) {
      return "";
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  private readBodyValue(step: ScenarioStep, api: ApiResponseDiagnostic): unknown {
    if (step.body_path) {
      return readPath(api.bodyJson, step.body_path);
    }
    return api.bodyJson ?? api.bodyText;
  }

  private now(): string {
    return this.input.now?.() ?? new Date().toISOString();
  }
}

function apiAssertionError(message: string, api: ApiResponseDiagnostic): Error {
  return Object.assign(new Error(message), { apiDiagnostic: api });
}

function parseJson(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function readPath(value: unknown, pathExpression: string): unknown {
  return pathExpression.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[key];
  }, value);
}

function readConfiguredBusinessCode(bodyJson: unknown, overridePath?: string): unknown {
  if (!isRecord(bodyJson)) {
    return undefined;
  }
  const paths = overridePath ? [overridePath] : apiBusinessConfig().codePaths;
  for (const pathExpression of paths) {
    const value = readPath(bodyJson, pathExpression);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function apiBusinessConfig(): {
  codePaths: string[];
  successCodes: ApiExpectedValue[];
  failureCodes: ApiExpectedValue[];
} {
  return {
    codePaths: parseList(process.env.API_BUSINESS_CODE_PATHS, ["code"]),
    successCodes: parseList(process.env.API_BUSINESS_SUCCESS_CODES, ["0000", "0", "200", "success", "SUCCESS"]),
    failureCodes: parseList(process.env.API_BUSINESS_FAILURE_CODES, [])
  };
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function isExpectedApiValue(actual: unknown, expected: unknown): boolean {
  if (actual === expected) {
    return true;
  }
  const actualText = String(actual ?? "").trim();
  const expectedText = String(expected ?? "").trim();
  if (actualText === expectedText) {
    return true;
  }
  if (/^\d+$/.test(actualText) && /^\d+$/.test(expectedText)) {
    return Number(actualText) === Number(expectedText);
  }
  return false;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n...<truncated ${value.length - maxLength} chars>`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/("(?:password|passwd|pwd|token|accessToken|refreshToken|authorization|cookie)"\s*:\s*)"[^"]*"/gi, "$1\"******\"")
    .replace(/((?:password|passwd|pwd|token|authorization|cookie)=)[^&\s"]+/gi, "$1******")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1******");
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

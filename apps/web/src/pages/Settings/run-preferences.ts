import type { EnvVariable, RunSettings, VideoMode } from "../../types/settings";

const DEFAULT_RUN_PREFERENCES: Omit<RunSettings, "env"> = {
  headless: false,
  slowMo: 100,
  trace: true,
  screenshot: true,
  video: "retain-on-failure",
  flowLoginTimeoutMs: 3000,
  visualMode: false,
  apiBusinessCodeStrict: true
};

export function parseRunPreferences(variables: EnvVariable[]): Omit<RunSettings, "env"> {
  const valueOf = (key: string) => variables.find((item) => item.key === key)?.value;
  const slowMo = Number(valueOf("SLOW_MO") ?? DEFAULT_RUN_PREFERENCES.slowMo);
  const flowLoginTimeoutMs = Number(valueOf("FLOW_LOGIN_TIMEOUT_MS") ?? DEFAULT_RUN_PREFERENCES.flowLoginTimeoutMs);

  return {
    headless: valueOf("HEADLESS") === "true",
    slowMo: Number.isFinite(slowMo) ? slowMo : DEFAULT_RUN_PREFERENCES.slowMo,
    trace: valueOf("TRACE") !== "off",
    screenshot: valueOf("SCREENSHOT") !== "off",
    video: parseVideoMode(valueOf("VIDEO")),
    flowLoginTimeoutMs: Number.isFinite(flowLoginTimeoutMs) ? flowLoginTimeoutMs : DEFAULT_RUN_PREFERENCES.flowLoginTimeoutMs,
    visualMode: valueOf("VISUAL_MODE") === "true",
    apiBusinessCodeStrict: valueOf("API_BUSINESS_CODE_STRICT") !== "false"
  };
}

export function upsertVariableValue(variables: EnvVariable[], key: string, value: string): EnvVariable[] {
  const index = variables.findIndex((item) => item.key === key);
  if (index < 0) {
    return [...variables, { key, value, source: "file", sensitive: isSensitiveKey(key) }];
  }
  return variables.map((item, itemIndex) => (itemIndex === index ? { ...item, value, source: "file" } : item));
}

export function isSensitiveKey(key: string): boolean {
  return /(password|token|secret|key|cookie|authorization|apikey)/i.test(key);
}

function parseVideoMode(value: string | undefined): VideoMode {
  return value === "off" || value === "on" || value === "retain-on-failure" ? value : DEFAULT_RUN_PREFERENCES.video;
}

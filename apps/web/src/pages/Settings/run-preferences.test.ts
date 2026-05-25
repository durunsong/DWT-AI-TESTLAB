import assert from "node:assert/strict";
import test from "node:test";
import { parseRunPreferences, upsertVariableValue } from "./run-preferences";
import type { EnvVariable } from "../../types/settings";

const variables: EnvVariable[] = [
  { key: "HEADLESS", value: "false", source: "file", sensitive: false },
  { key: "SLOW_MO", value: "250", source: "file", sensitive: false },
  { key: "TRACE", value: "on", source: "file", sensitive: false },
  { key: "SCREENSHOT", value: "only-on-failure", source: "file", sensitive: false },
  { key: "VIDEO", value: "retain-on-failure", source: "file", sensitive: false },
  { key: "FLOW_LOGIN_TIMEOUT_MS", value: "10000", source: "file", sensitive: false },
  { key: "VISUAL_MODE", value: "true", source: "file", sensitive: false },
  { key: "API_BUSINESS_CODE_STRICT", value: "false", source: "file", sensitive: false }
];

test("parses run preferences from env variables with video, login timeout, visual mode and API strict code", () => {
  assert.deepEqual(parseRunPreferences(variables), {
    headless: false,
    slowMo: 250,
    trace: true,
    screenshot: true,
    video: "retain-on-failure",
    flowLoginTimeoutMs: 10000,
    visualMode: true,
    apiBusinessCodeStrict: false
  });
});

test("falls back to safe defaults when run preference values are missing or invalid", () => {
  assert.deepEqual(parseRunPreferences([{ key: "SLOW_MO", value: "bad", source: "file", sensitive: false }]), {
    headless: false,
    slowMo: 100,
    trace: true,
    screenshot: true,
    video: "retain-on-failure",
    flowLoginTimeoutMs: 3000,
    visualMode: false,
    apiBusinessCodeStrict: true
  });
});

test("upserts run preference variables without changing unrelated variables", () => {
  const next = upsertVariableValue([{ key: "USER_LOGIN_URL", value: "http://localhost", source: "file", sensitive: false }], "VIDEO", "off");

  assert.deepEqual(next.map((item) => [item.key, item.value]), [
    ["USER_LOGIN_URL", "http://localhost"],
    ["VIDEO", "off"]
  ]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildDoctorReport, formatDoctorReport } from "./cli-doctor";

test("doctor reports missing AI configuration without exposing values", async () => {
  const report = await buildDoctorReport({
    rootDir: "/workspace",
    env: {
      AI_BASE_URL: "https://ai.example/v1",
      AI_MODEL: "qwen-test",
      AI_API_KEY: "sk-secret"
    },
    exists: async (filePath) => !filePath.endsWith("platform.config.json"),
    listCases: async () => []
  });

  const text = formatDoctorReport(report);

  assert.equal(report.ok, false);
  assert.match(text, /platform_config/);
  assert.match(text, /cases_empty/);
  assert.doesNotMatch(text, /sk-secret/);
});

test("doctor passes when required workspace files and cases exist", async () => {
  const report = await buildDoctorReport({
    rootDir: "/workspace",
    env: {
      AI_BASE_URL: "https://ai.example/v1",
      AI_MODEL: "qwen-test",
      AI_API_KEY: "sk-secret",
      USER_LOGIN_URL: "https://test.example/login",
      ADMIN_LOGIN_URL: "https://test-admin.example/login"
    },
    exists: async () => true,
    listCases: async () => ["login_user"]
  });

  assert.equal(report.ok, true);
  assert.equal(report.items.every((item) => item.status !== "error"), true);
});

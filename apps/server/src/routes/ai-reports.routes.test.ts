import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";
import { AiReportService } from "../services/ai-report.service";
import { registerAiReportRoutes } from "./ai-reports.routes";

test("returns saved AI report by run id", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-ai-report-route-"));
  const service = new AiReportService(rootDir);
  await service.saveAnalysis({
    runId: "run_a",
    caseId: "case_a",
    env: "local",
    stepId: "step_a",
    source: "auto_failure",
    status: "completed",
    content: "analysis"
  });
  const app = Fastify({ logger: false });
  await registerAiReportRoutes(app, service);

  const response = await app.inject({ method: "GET", url: "/api/ai-reports/run_a" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.analyses[0].content, "analysis");
  await app.close();
});

test("returns null when AI report does not exist", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-ai-report-route-missing-"));
  const app = Fastify({ logger: false });
  await registerAiReportRoutes(app, new AiReportService(rootDir));

  const response = await app.inject({ method: "GET", url: "/api/ai-reports/missing_run" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data, null);
  await app.close();
});

test("serves AI analysis markdown artifact", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-ai-report-route-file-"));
  const service = new AiReportService(rootDir);
  await service.saveAnalysis({
    runId: "run_a",
    caseId: "case_a",
    env: "local",
    stepId: "step_a",
    source: "manual_screenshot",
    status: "completed",
    content: "markdown content"
  });
  const app = Fastify({ logger: false });
  await registerAiReportRoutes(app, service);

  const response = await app.inject({ method: "GET", url: "/ai-reports/run_a/step_a.manual_screenshot.analysis.md" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "markdown content\n");
  await app.close();
});

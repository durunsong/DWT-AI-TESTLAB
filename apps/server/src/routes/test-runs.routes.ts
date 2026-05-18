import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { CreateTestRunRequest } from "@ai-e2e/shared";
import type { ReportService } from "../services/report.service";
import type { TestRunService } from "../services/test-run.service";
import { ok } from "../utils/response";

export async function registerTestRunRoutes(
  app: FastifyInstance,
  testRunService: TestRunService,
  reportService: ReportService
): Promise<void> {
  app.post<{ Body: CreateTestRunRequest }>("/api/test-runs", async (request) => {
    const run = await testRunService.start(request.body);
    return ok({ runId: run.runId, status: run.status });
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId", async (request) => {
    return ok(testRunService.get(request.params.runId));
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/report", async (request) => {
    return ok(await reportService.readJsonReport(request.params.runId));
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/logs", async (request) => {
    return ok(await reportService.readLog(request.params.runId));
  });

  app.get<{ Params: { runId: string; file: string } }>("/reports/:file", async (request, reply) => {
    const filePath = testRunService.assetPath("reports", path.basename(request.params.file));
    reply.type(request.params.file.endsWith(".html") ? "text/html; charset=utf-8" : "application/json; charset=utf-8");
    return fs.readFile(filePath, "utf8");
  });
}

import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { CreateTestRunRequest } from "@ai-e2e/shared";
import type { ArtifactKind, ReportService } from "../services/report.service";
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

  app.get("/api/test-runs/history", async () => {
    return ok(await reportService.listHistory());
  });

  app.get("/api/artifacts", async () => {
    return ok(await reportService.artifactSummaries());
  });

  app.post<{ Body: { kinds?: ArtifactKind[] } }>("/api/artifacts/clear", async (request) => {
    const defaultKinds: ArtifactKind[] = ["logs", "screenshots", "reports", "traces"];
    const kinds = request.body.kinds?.length ? request.body.kinds : defaultKinds;
    return ok(await reportService.clearArtifacts(kinds));
  });

  app.delete<{ Params: { runId: string } }>("/api/test-runs/history/:runId", async (request) => {
    return ok(await reportService.deleteRunHistory(request.params.runId));
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId", async (request) => {
    if (request.params.runId === "latest") {
      const latest = (await reportService.listHistory())[0];
      return ok(latest ? await reportService.readRunSummary(latest.runId) : null);
    }

    try {
      return ok(testRunService.get(request.params.runId));
    } catch {
      return ok(await reportService.readRunSummary(request.params.runId));
    }
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/report", async (request) => {
    if (request.params.runId === "latest") {
      const latest = (await reportService.listHistory())[0];
      return ok(latest ? await reportService.readJsonReport(latest.runId) : null);
    }
    return ok(await reportService.readJsonReport(request.params.runId));
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/logs", async (request) => {
    if (request.params.runId === "latest") {
      const latest = (await reportService.listHistory())[0];
      return ok(latest ? await reportService.readLog(latest.runId) : "");
    }
    return ok(await reportService.readLog(request.params.runId));
  });

  app.get<{ Params: { runId: string; file: string } }>("/reports/:file", async (request, reply) => {
    if (request.params.file === "favicon.png" || request.params.file === "favicon.ico") {
      return reply.status(204).send();
    }

    const filePath = testRunService.artifactPath("reports", path.basename(request.params.file));
    reply.type(request.params.file.endsWith(".html") ? "text/html; charset=utf-8" : "application/json; charset=utf-8");
    return fs.readFile(filePath, "utf8");
  });

  app.get<{ Params: { runId: string; file: string } }>("/screenshots/:runId/:file", async (request, reply) => {
    const filePath = testRunService.artifactPath("screenshots", path.basename(request.params.runId), path.basename(request.params.file));
    reply.type("image/png");
    return fs.readFile(filePath);
  });
}

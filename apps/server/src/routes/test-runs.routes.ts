import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { CreateBatchTestRunRequest, CreateTestRunRequest, TestRunSummary } from "@ai-e2e/shared";
import type { ArtifactKind, ReportService, RunHistoryItem } from "../services/report.service";
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

  app.post<{ Body: CreateBatchTestRunRequest }>("/api/test-runs/batch", async (request) => {
    return ok(await testRunService.startBatch(request.body));
  });

  app.get<{ Params: { batchId: string } }>("/api/test-runs/batch/:batchId", async (request) => {
    return ok(testRunService.findBatch(request.params.batchId));
  });

  app.get("/api/test-runs/history", async () => {
    return ok(mergeRunningRunIntoHistory(await reportService.listHistory(), testRunService.latestRun()));
  });

  app.get("/api/artifacts", async () => {
    return ok(await reportService.artifactSummaries());
  });

  app.get<{ Params: { kind: ArtifactKind; runId: string } }>("/api/artifacts/:kind/:runId/files", async (request) => {
    return ok(await reportService.listArtifactFiles(request.params.kind, request.params.runId));
  });

  app.post<{ Body: { kinds?: ArtifactKind[] } }>("/api/artifacts/clear", async (request) => {
    const defaultKinds: ArtifactKind[] = ["logs", "screenshots", "reports", "traces", "videos", "ai-reports"];
    const kinds = request.body.kinds?.length ? request.body.kinds : defaultKinds;
    return ok(await reportService.clearArtifacts(kinds));
  });

  app.delete<{ Params: { runId: string } }>("/api/test-runs/history/:runId", async (request) => {
    return ok(await reportService.deleteRunHistory(request.params.runId));
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId", async (request) => {
    if (request.params.runId === "latest") {
      const running = testRunService.latestRun();
      if (running) {
        return ok(running);
      }
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
      const running = testRunService.latestRun();
      if (running) {
        return ok(running.status === "running" ? null : await reportService.readJsonReport(running.runId).catch(() => null));
      }
      const latest = (await reportService.listHistory())[0];
      return ok(latest ? await reportService.readJsonReport(latest.runId) : null);
    }
    try {
      testRunService.get(request.params.runId);
      return ok(await reportService.readJsonReport(request.params.runId).catch(() => null));
    } catch {
      return ok(await reportService.readJsonReport(request.params.runId));
    }
  });

  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/logs", async (request) => {
    if (request.params.runId === "latest") {
      const running = testRunService.latestRun();
      if (running) {
        return ok(await reportService.readLog(running.runId).catch(() => ""));
      }
      const latest = (await reportService.listHistory())[0];
      return ok(latest ? await reportService.readLog(latest.runId) : "");
    }
    try {
      testRunService.get(request.params.runId);
      return ok(await reportService.readLog(request.params.runId).catch(() => ""));
    } catch {
      return ok(await reportService.readLog(request.params.runId));
    }
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

  app.get<{ Params: { runId: string; file: string } }>("/traces/:runId/:file", async (request, reply) => {
    const filePath = testRunService.artifactPath("traces", path.basename(request.params.runId), path.basename(request.params.file));
    reply.type("application/zip");
    return fs.readFile(filePath);
  });

  app.get<{ Params: { runId: string; file: string } }>("/videos/:runId/:file", async (request, reply) => {
    const filePath = testRunService.artifactPath("videos", path.basename(request.params.runId), path.basename(request.params.file));
    reply.type("video/webm");
    return fs.readFile(filePath);
  });
}

export function mergeRunningRunIntoHistory(history: RunHistoryItem[], latestRun: TestRunSummary | undefined): RunHistoryItem[] {
  if (!latestRun || latestRun.status !== "running" || history.some((item) => item.runId === latestRun.runId)) {
    return history;
  }

  const runningItem: RunHistoryItem = {
    runId: latestRun.runId,
    caseId: latestRun.caseId,
    caseName: latestRun.caseName ?? latestRun.caseId,
    env: latestRun.env,
    status: latestRun.status,
    startedAt: latestRun.startedAt,
    endedAt: latestRun.endedAt,
    durationMs: latestRun.durationMs,
    total: latestRun.total,
    passed: latestRun.passed,
    failed: latestRun.failed,
    skipped: latestRun.skipped,
    reportLinks: {
      html: latestRun.reportLinks.html ?? `/reports/${latestRun.runId}.html`,
      json: latestRun.reportLinks.json ?? `/api/test-runs/${latestRun.runId}/report`,
      logs: latestRun.reportLinks.logs ?? `/api/test-runs/${latestRun.runId}/logs`,
      screenshots: latestRun.reportLinks.screenshots ?? `/screenshots/${latestRun.runId}`,
      traces: latestRun.reportLinks.traces ?? `/traces/${latestRun.runId}`,
      videos: latestRun.reportLinks.videos ?? `/videos/${latestRun.runId}`
    }
  };

  return [runningItem, ...history].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

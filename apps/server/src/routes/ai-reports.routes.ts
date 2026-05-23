import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AiReportService } from "../services/ai-report.service";
import { ok } from "../utils/response";

export async function registerAiReportRoutes(app: FastifyInstance, aiReportService: AiReportService): Promise<void> {
  app.get<{ Params: { runId: string } }>("/api/ai-reports/:runId", async (request) => {
    const report = await aiReportService.readReport(request.params.runId).catch(() => null);
    return ok(report);
  });

  app.get<{ Params: { runId: string; file: string } }>("/ai-reports/:runId/:file", async (request, reply) => {
    const filePath = path.resolve(aiReportService.reportsDir(), path.basename(request.params.runId), path.basename(request.params.file));
    reply.type("text/markdown; charset=utf-8");
    return fs.readFile(filePath, "utf8");
  });
}

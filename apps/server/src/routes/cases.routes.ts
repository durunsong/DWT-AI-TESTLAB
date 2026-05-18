import type { FastifyInstance } from "fastify";
import type { CaseService } from "../services/case.service";
import { ok } from "../utils/response";

export async function registerCaseRoutes(app: FastifyInstance, caseService: CaseService): Promise<void> {
  app.get("/api/cases", async () => ok(await caseService.listCases()));
}

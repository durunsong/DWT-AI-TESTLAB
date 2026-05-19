import type { FastifyInstance } from "fastify";
import type { CaseService } from "../services/case.service";
import { ok } from "../utils/response";

export async function registerCaseRoutes(app: FastifyInstance, caseService: CaseService): Promise<void> {
  app.get("/api/cases", async () => ok(await caseService.listCases()));

  app.post<{
    Body: {
      caseId: string;
      caseName: string;
      description?: string;
      template: "user_login" | "admin_login" | "user_admin_kyc";
    };
  }>("/api/cases", async (request) => {
    return ok(await caseService.createCase(request.body));
  });

  app.post<{ Body: { content: string; caseId?: string } }>("/api/cases/import-yaml", async (request) => {
    return ok(await caseService.createCaseFromYaml(caseService.normalizeGeneratedYaml(request.body.content), request.body.caseId));
  });

  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.getCase(request.params.caseId));
  });

  app.put<{ Params: { caseId: string }; Body: { content: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.saveCase(request.params.caseId, request.body.content));
  });

  app.delete<{ Params: { caseId: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.deleteCase(request.params.caseId));
  });

  app.post<{ Body: { content: string } }>("/api/cases/validate", async (request) => {
    return ok(caseService.validateContent(request.body.content));
  });
}

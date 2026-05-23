import type { FastifyInstance } from "fastify";
import { megabytesToBytes, type PlatformConfig } from "@ai-e2e/runner";
import type { CaseService } from "../services/case.service";
import { ok } from "../utils/response";

export async function registerCaseRoutes(app: FastifyInstance, caseService: CaseService, platformConfig: PlatformConfig): Promise<void> {
  const attachmentBodyLimit = Math.max(megabytesToBytes(platformConfig.uploads.caseAttachmentMaxMb) * 2, 1024 * 1024);

  app.get("/api/cases", async () => ok(await caseService.listCases()));

  app.get("/api/cases/shared-abilities", async () => ok(await caseService.listSharedAbilities()));

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

  app.post<{ Body: { content: string } }>("/api/cases/normalize-yaml", async (request) => {
    return ok(caseService.normalizeGeneratedYaml(request.body.content));
  });

  app.post<{
    Body: {
      caseId: string;
      fileName: string;
      mimeType?: string;
      base64: string;
    };
  }>("/api/cases/attachments", { bodyLimit: attachmentBodyLimit }, async (request) => {
    return ok(await caseService.saveAttachment(request.body));
  });

  app.get<{
    Querystring: {
      caseId?: string;
      query?: string;
      limit?: string;
    };
  }>("/api/cases/attachments/search", async (request) => {
    return ok(await caseService.searchAttachments({
      caseId: request.query.caseId,
      query: request.query.query,
      limit: request.query.limit ? Number(request.query.limit) : undefined
    }));
  });

  app.get<{ Querystring: { file: string; download?: string } }>("/api/cases/attachments/file", async (request, reply) => {
    const attachment = await caseService.readAttachment(request.query.file);
    if (request.query.download === "true") {
      reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
    }
    reply.type(contentTypeByFileName(attachment.name));
    return attachment.content;
  });

  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId/attachments", async (request) => {
    return ok(await caseService.listAttachments(request.params.caseId));
  });

  app.delete<{ Params: { caseId: string }; Querystring: { file: string } }>("/api/cases/:caseId/attachments", async (request) => {
    return ok(await caseService.deleteAttachment(request.params.caseId, request.query.file));
  });

  app.post<{ Body: { content: string; env?: string } }>("/api/cases/preflight", async (request) => {
    return ok(await caseService.preflightContent(request.body.content, request.body.env));
  });

  app.get<{ Params: { caseId: string }; Querystring: { env?: string } }>("/api/cases/:caseId/preflight", async (request) => {
    return ok(await caseService.preflightCase(request.params.caseId, request.query.env));
  });

  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.getCase(request.params.caseId));
  });

  app.put<{ Params: { caseId: string }; Body: { content: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.saveCase(request.params.caseId, request.body.content));
  });

  app.delete<{ Params: { caseId: string }; Querystring: { deleteAttachments?: string } }>("/api/cases/:caseId", async (request) => {
    return ok(await caseService.deleteCase(request.params.caseId, {
      deleteAttachments: request.query.deleteAttachments === "true"
    }));
  });

  app.post<{ Body: { content: string } }>("/api/cases/validate", async (request) => {
    return ok(await caseService.validateContentForRun(request.body.content));
  });
}

function contentTypeByFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

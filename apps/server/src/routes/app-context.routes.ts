import type { FastifyInstance } from "fastify";
import type { AppContextService } from "../services/app-context.service";
import { ok } from "../utils/response";

export async function registerAppContextRoutes(app: FastifyInstance, service: AppContextService): Promise<void> {
  registerContextRouteSet(app, service, "/api/app/context");
}

function registerContextRouteSet(app: FastifyInstance, service: AppContextService, prefix: string): void {
  const bodyLimit = service.contextBodyLimitBytes();

  app.get(prefix, async () => ok(await service.getContext()));
  app.get(`${prefix}/overview`, async () => ok(await service.getContextOverview()));

  app.get<{
    Params: {
      source: string;
    };
  }>(`${prefix}/sources/:source`, async (request) => {
    return ok(await service.getSource(normalizeSource(request.params.source)));
  });

  app.put<{
    Params: {
      source: string;
    };
    Body: {
      fileName: string;
      content: string;
    };
  }>(`${prefix}/sources/:source`, { bodyLimit }, async (request) => {
    const source = normalizeSource(request.params.source);
    const { fileName, content } = request.body;
    validateSourcePayload(fileName, content);
    return ok(await service.saveSource({ source, fileName, content }));
  });

  app.delete<{
    Params: {
      source: string;
    };
  }>(`${prefix}/sources/:source`, async (request) => {
    return ok(await service.deleteSource(normalizeSource(request.params.source)));
  });

  app.post<{
    Body: {
      source: string;
      fileName: string;
      content: string;
    };
  }>(`${prefix}/parse`, { bodyLimit }, async (request) => {
    const source = normalizeSource(request.body.source);
    const { fileName, content } = request.body;
    validateSourcePayload(fileName, content);
    return ok(service.parseSource({ source, fileName, content }));
  });
}

function normalizeSource(source: string): string {
  const sourceKey = source.trim();
  if (/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(sourceKey)) {
    return sourceKey;
  }
  throw new Error("路由来源标识只能使用字母开头的英文、数字、下划线或中划线，最长 64 位");
}

function validateSourcePayload(fileName: string, content: string): void {
  if (!fileName?.trim()) {
    throw new Error("文件名不能为空");
  }
  if (!content?.trim()) {
    throw new Error("路由文件内容不能为空");
  }
}

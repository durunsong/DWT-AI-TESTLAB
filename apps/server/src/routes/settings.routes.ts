import type { FastifyInstance } from "fastify";
import type { EnvConfigService, EnvVariable } from "../services/env-config.service";
import { normalizeTestEnv } from "../services/env-config.service";
import { ok } from "../utils/response";

export async function registerSettingsRoutes(app: FastifyInstance, envConfigService: EnvConfigService): Promise<void> {
  app.get("/api/settings/env-files", async () => {
    return ok(await envConfigService.list());
  });

  app.get<{ Params: { env: string } }>("/api/settings/env-files/:env", async (request) => {
    return ok(await envConfigService.get(normalizeTestEnv(request.params.env)));
  });

  app.get<{ Params: { env: string } }>("/api/settings/env-files/:env/content", async (request) => {
    return ok(await envConfigService.getContent(normalizeTestEnv(request.params.env)));
  });

  app.put<{ Params: { env: string }; Body: { variables: Array<Pick<EnvVariable, "key" | "value" | "comment">> } }>(
    "/api/settings/env-files/:env",
    async (request) => {
      return ok(await envConfigService.save(normalizeTestEnv(request.params.env), request.body.variables ?? []));
    }
  );

  app.put<{ Params: { env: string }; Body: { content?: string } }>("/api/settings/env-files/:env/content", async (request) => {
    return ok(await envConfigService.saveContent(normalizeTestEnv(request.params.env), request.body.content ?? ""));
  });

  app.post<{
    Params: { env: string };
    Body: { content?: string };
  }>("/api/settings/env-files/:env/import", async (request) => {
    return ok(await envConfigService.importContent(normalizeTestEnv(request.params.env), request.body.content ?? ""));
  });
}

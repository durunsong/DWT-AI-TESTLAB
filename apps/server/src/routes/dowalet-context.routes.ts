import type { FastifyInstance } from "fastify";
import type { DowaletContextService } from "../services/dowalet-context.service";
import { ok } from "../utils/response";

export async function registerDowaletContextRoutes(app: FastifyInstance, service: DowaletContextService): Promise<void> {
  app.get("/api/dowalet/context", async () => ok(await service.getContext()));
}

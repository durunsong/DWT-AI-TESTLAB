import type { FastifyInstance } from "fastify";
import type { DbService } from "../services/db.service";
import { ok } from "../utils/response";

export async function registerDbRoutes(app: FastifyInstance, service: DbService): Promise<void> {
  app.get("/api/db/health", async () => ok(await service.health()));
}

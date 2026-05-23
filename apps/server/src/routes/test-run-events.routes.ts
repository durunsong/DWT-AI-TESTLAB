import type { FastifyInstance } from "fastify";
import type { TestRunService } from "../services/test-run.service";

export async function registerTestRunEventRoutes(app: FastifyInstance, testRunService: TestRunService): Promise<void> {
  app.get<{ Params: { runId: string } }>("/api/test-runs/:runId/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    reply.raw.write(": connected\n\n");

    const unsubscribe = testRunService.subscribe(request.params.runId, (event) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on("close", unsubscribe);
  });
}

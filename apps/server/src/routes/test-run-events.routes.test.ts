import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import { registerTestRunEventRoutes } from "./test-run-events.routes";

test("hijacks the Fastify reply before writing SSE events", async () => {
  let handler: ((request: unknown, reply: unknown) => Promise<void>) | undefined;
  const app = {
    get(_url: string, routeHandler: typeof handler) {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;
  const service = {
    subscribe() {
      return () => undefined;
    }
  };
  const request = {
    params: { runId: "run_1" },
    raw: new EventEmitter()
  };
  let hijacked = false;
  const reply = {
    hijack() {
      hijacked = true;
    },
    raw: {
      writeHead() {
        return undefined;
      },
      write() {
        return true;
      }
    }
  };

  await registerTestRunEventRoutes(app, service as never);
  await handler?.(request, reply);

  assert.equal(hijacked, true);
});

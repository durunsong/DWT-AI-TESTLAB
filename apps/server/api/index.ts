import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createServer, resolveServerRootDir } from "../src/index";

let appPromise: Promise<FastifyInstance> | undefined;

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const app = await getApp();
  app.server.emit("request", request, response);
}

async function getApp(): Promise<FastifyInstance> {
  appPromise ??= createServer({
    rootDir: resolveServerRootDir(path.resolve(process.cwd(), "../..")),
    logger: false
  }).then(async (app) => {
    await app.ready();
    return app;
  });
  return appPromise;
}

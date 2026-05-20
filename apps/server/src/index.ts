import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Fastify, { type FastifyInstance } from "fastify";
import { ScenarioOrchestrator } from "@ai-e2e/runner";
import { registerAiRoutes } from "./routes/ai.routes";
import { registerCaseRoutes } from "./routes/cases.routes";
import { registerDbRoutes } from "./routes/db.routes";
import { registerDowaletContextRoutes } from "./routes/dowalet-context.routes";
import { registerSettingsRoutes } from "./routes/settings.routes";
import { registerTestRunEventRoutes } from "./routes/test-run-events.routes";
import { registerTestRunRoutes } from "./routes/test-runs.routes";
import { CaseService } from "./services/case.service";
import { DbService } from "./services/db.service";
import { DowaletContextService } from "./services/dowalet-context.service";
import { EnvConfigService } from "./services/env-config.service";
import { ReportService } from "./services/report.service";
import { TestRunService } from "./services/test-run.service";

export interface CreateServerOptions {
  rootDir: string;
  logger?: boolean;
}

export interface StartServerOptions {
  rootDir?: string;
  port?: number;
  host?: string;
  logger?: boolean;
}

export interface StartedServer {
  app: FastifyInstance;
  rootDir: string;
  host: string;
  port: number;
  origin: string;
  close: () => Promise<void>;
}

export async function createServer(options: CreateServerOptions): Promise<FastifyInstance> {
  const rootDir = path.resolve(options.rootDir);
  dotenv.config({ path: path.resolve(rootDir, ".env") });

  const app = Fastify({ logger: options.logger ?? true });
  registerCors(app);

  const runner = new ScenarioOrchestrator(rootDir);
  const envConfigService = new EnvConfigService(rootDir);
  const caseService = new CaseService(runner, rootDir);
  const testRunService = new TestRunService(runner, rootDir, envConfigService);
  const reportService = new ReportService(rootDir);
  const dowaletContextService = new DowaletContextService(rootDir);
  const dbService = new DbService();

  await registerCaseRoutes(app, caseService);
  await registerTestRunRoutes(app, testRunService, reportService);
  await registerTestRunEventRoutes(app, testRunService);
  await registerAiRoutes(app, rootDir);
  await registerDowaletContextRoutes(app, dowaletContextService);
  await registerDbRoutes(app, dbService);
  await registerSettingsRoutes(app, envConfigService);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(400).send({ code: 1, message: getErrorMessage(error), data: null });
  });

  return app;
}

export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const rootDir = path.resolve(options.rootDir ?? findWorkspaceRoot(process.cwd()));
  const host = options.host ?? "0.0.0.0";
  const app = await createServer({ rootDir, logger: options.logger });
  await app.listen({ port: options.port ?? Number(process.env.SERVER_PORT ?? 4300), host });

  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : Number(process.env.SERVER_PORT ?? 4300);
  const originHost = host === "0.0.0.0" ? "127.0.0.1" : host;

  return {
    app,
    rootDir,
    host,
    port,
    origin: `http://${originHost}:${port}`,
    close: () => app.close()
  };
}

function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.resolve(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function registerCors(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "content-type,authorization");
    if (request.method === "OPTIONS") {
      reply.status(204).send();
      return;
    }
    done();
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isDirectRun()) {
  const port = Number(process.env.SERVER_PORT ?? 4300);
  void startServer({ port, host: "0.0.0.0" }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry).replace(/\\/g, "/").endsWith("/apps/server/src/index.ts");
}

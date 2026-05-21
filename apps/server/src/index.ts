import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Fastify, { type FastifyInstance } from "fastify";
import { loadPlatformConfig, type PlatformConfig, ScenarioOrchestrator } from "@ai-e2e/runner";
import { registerAiRoutes } from "./routes/ai.routes";
import { registerCaseRoutes } from "./routes/cases.routes";
import { registerDbRoutes } from "./routes/db.routes";
import { registerAppContextRoutes } from "./routes/app-context.routes";
import { registerSettingsRoutes } from "./routes/settings.routes";
import { registerTestRunEventRoutes } from "./routes/test-run-events.routes";
import { registerTestRunRoutes } from "./routes/test-runs.routes";
import { CaseService } from "./services/case.service";
import { DbService } from "./services/db.service";
import { AppContextService } from "./services/app-context.service";
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
  const platformConfig = loadPlatformConfig(rootDir);

  const app = Fastify({ logger: options.logger ?? true });
  registerCors(app, platformConfig.server.corsOrigins);

  const runner = new ScenarioOrchestrator(rootDir);
  const envConfigService = new EnvConfigService(rootDir);
  const caseService = new CaseService(runner, rootDir, envConfigService);
  const testRunService = new TestRunService(runner, rootDir, envConfigService, platformConfig);
  const reportService = new ReportService(rootDir, platformConfig);
  const appContextService = new AppContextService(rootDir, platformConfig);
  const dbService = new DbService();

  await registerCaseRoutes(app, caseService);
  await registerTestRunRoutes(app, testRunService, reportService);
  await registerTestRunEventRoutes(app, testRunService);
  await registerAiRoutes(app, rootDir, platformConfig);
  await registerAppContextRoutes(app, appContextService);
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
  const platformConfig = loadPlatformConfig(rootDir);
  const host = options.host ?? process.env.SERVER_HOST ?? platformConfig.server.host;
  const app = await createServer({ rootDir, logger: options.logger });
  const configuredPort = Number(process.env.SERVER_PORT ?? platformConfig.server.port);
  await app.listen({ port: options.port ?? configuredPort, host });

  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : configuredPort;
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

function registerCors(app: FastifyInstance, allowedOrigins: PlatformConfig["server"]["corsOrigins"]): void {
  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    const allowedOrigin = resolveCorsOrigin(typeof origin === "string" ? origin : undefined, allowedOrigins);
    if (allowedOrigin) {
      reply.header("Access-Control-Allow-Origin", allowedOrigin);
    }
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "content-type,authorization");
    if (request.method === "OPTIONS") {
      reply.status(204).send();
      return;
    }
    done();
  });
}

function resolveCorsOrigin(origin: string | undefined, allowedOrigins: string[]): string | undefined {
  if (allowedOrigins.includes("*")) {
    return "*";
  }
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isDirectRun()) {
  const platformConfig = loadPlatformConfig(findWorkspaceRoot(process.cwd()));
  const port = Number(process.env.SERVER_PORT ?? platformConfig.server.port);
  const host = process.env.SERVER_HOST ?? platformConfig.server.host;
  void startServer({ port, host }).catch((error: unknown) => {
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

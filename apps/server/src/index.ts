import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Fastify from "fastify";
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

const rootDir = findWorkspaceRoot(process.cwd());
dotenv.config({ path: path.resolve(rootDir, ".env") });

const app = Fastify({ logger: true });
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
  reply.status(400).send({ code: 1, message: error.message, data: null });
});

const port = Number(process.env.SERVER_PORT ?? 4300);
await app.listen({ port, host: "0.0.0.0" });

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

import { DbExecutor } from "@ai-e2e/runner";

export class DbService {
  health() {
    return new DbExecutor({
      env: process.env.TEST_ENV ?? "local",
      enabled: process.env.DB_ENABLED === "true"
    }).health();
  }
}

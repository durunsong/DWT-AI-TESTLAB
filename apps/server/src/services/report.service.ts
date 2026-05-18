import fs from "node:fs/promises";
import path from "node:path";

export class ReportService {
  constructor(private readonly rootDir: string) {}

  async readJsonReport(runId: string): Promise<unknown> {
    const file = path.resolve(this.rootDir, "reports", `${runId}.json`);
    return JSON.parse(await fs.readFile(file, "utf8"));
  }

  async readLog(runId: string): Promise<string> {
    const file = path.resolve(this.rootDir, "logs", `${runId}.log`);
    return fs.readFile(file, "utf8");
  }
}

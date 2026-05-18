import fs from "node:fs/promises";
import { maskSensitive, type RunReport } from "@ai-e2e/shared";

export class JsonReportBuilder {
  async write(reportPath: string, report: RunReport): Promise<void> {
    await fs.writeFile(reportPath, `${JSON.stringify(maskSensitive(report), null, 2)}\n`, "utf8");
  }
}

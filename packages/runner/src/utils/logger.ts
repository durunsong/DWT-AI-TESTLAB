import fs from "node:fs/promises";
import { maskSensitive } from "@ai-e2e/shared";

export class RunLogger {
  constructor(private readonly logFile: string) {}

  async info(message: string, meta?: Record<string, unknown>): Promise<void> {
    await this.write("INFO", message, meta);
  }

  async error(message: string, meta?: Record<string, unknown>): Promise<void> {
    await this.write("ERROR", message, meta);
  }

  private async write(level: "INFO" | "ERROR", message: string, meta?: Record<string, unknown>): Promise<void> {
    const payload = meta ? ` ${JSON.stringify(maskSensitive(meta))}` : "";
    await fs.appendFile(this.logFile, `[${new Date().toISOString()}] [${level}] ${message}${payload}\n`, "utf8");
  }
}

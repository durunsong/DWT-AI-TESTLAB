import fs from "node:fs/promises";
import path from "node:path";
import { scenarioCaseSchema, type ScenarioCase } from "@ai-e2e/shared";
import { loadYamlFile } from "./yaml-loader";

export class ScenarioLoader {
  constructor(private readonly rootDir: string) {}

  async list(): Promise<ScenarioCase[]> {
    const scenarioDir = path.resolve(this.rootDir, "cases", "scenario");
    const files = await fs.readdir(scenarioDir);
    const scenarios = await Promise.all(
      files.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml")).map((file) => this.load(path.resolve(scenarioDir, file)))
    );
    return scenarios.sort((a, b) => a.case_id.localeCompare(b.case_id));
  }

  async loadByCaseId(caseId: string): Promise<ScenarioCase> {
    const scenarios = await this.list();
    const scenario = scenarios.find((item) => item.case_id === caseId);
    if (!scenario) {
      throw new Error(`未找到用例：${caseId}`);
    }
    return scenario;
  }

  async load(filePath: string): Promise<ScenarioCase> {
    const raw = await loadYamlFile<unknown>(filePath);
    const parsed = scenarioCaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`DSL 校验失败：${filePath}\n${parsed.error.message}`);
    }
    return parsed.data;
  }
}

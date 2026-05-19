import fs from "node:fs/promises";
import path from "node:path";
import { scenarioCaseSchema, type ScenarioCase } from "@ai-e2e/shared";
import YAML from "yaml";
import { loadYamlFile } from "./yaml-loader";

export interface ScenarioValidationIssue {
  path: string;
  message: string;
}

export interface ScenarioValidationResult {
  valid: boolean;
  caseId?: string;
  caseName?: string;
  issues: ScenarioValidationIssue[];
  data?: ScenarioCase;
}

export function validateScenarioContent(content: string): ScenarioValidationResult {
  try {
    const raw = YAML.parse(content) as unknown;
    const rawCaseId = readStringField(raw, "case_id");
    const rawCaseName = readStringField(raw, "case_name");
    const parsed = scenarioCaseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        valid: false,
        caseId: rawCaseId,
        caseName: rawCaseName,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "root",
          message: issue.message
        }))
      };
    }
    return {
      valid: true,
      caseId: parsed.data.case_id,
      caseName: parsed.data.case_name,
      issues: [],
      data: parsed.data
    };
  } catch (error) {
    return {
      valid: false,
      issues: [{ path: "yaml", message: error instanceof Error ? error.message : String(error) }]
    };
  }
}

function readStringField(raw: unknown, key: string): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

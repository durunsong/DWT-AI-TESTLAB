import fs from "node:fs/promises";
import path from "node:path";
import { defaultCaseType, loadPlatformConfig, platformConfigFileName, validateScenarioContentForRun, type PlatformCaseType } from "@ai-e2e/runner";
import YAML from "yaml";

const CASE_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

export class PlatformSettingsService {
  constructor(private readonly rootDir: string) {}

  async listCaseTypes(): Promise<PlatformCaseType[]> {
    return loadPlatformConfig(this.rootDir).caseTypes;
  }

  async saveCaseTypes(input: PlatformCaseType[]): Promise<PlatformCaseType[]> {
    const current = await this.listCaseTypes();
    const next = this.normalizeCaseTypes(input);
    const nextKeys = new Set(next.map((item) => item.key));
    const deletedKeys = current.map((item) => item.key).filter((key) => !nextKeys.has(key));

    if (deletedKeys.includes(defaultCaseType.key)) {
      throw new Error("默认类型 uncategorized 不可删除");
    }

    const referenced = await this.collectReferencedCaseTypes();
    const referencedDeleted = deletedKeys.find((key) => referenced.has(key));
    if (referencedDeleted) {
      throw new Error(`用例类型 ${referencedDeleted} 仍被用例引用，请先迁移用例后再删除`);
    }

    const configPath = path.resolve(this.rootDir, platformConfigFileName);
    const raw = await this.readConfigObject(configPath);
    raw.caseTypes = next;
    await fs.writeFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    return loadPlatformConfig(this.rootDir).caseTypes;
  }

  private normalizeCaseTypes(input: PlatformCaseType[]): PlatformCaseType[] {
    const result: PlatformCaseType[] = [];
    const seen = new Set<string>();
    for (const item of input) {
      const key = String(item.key ?? "").trim();
      const label = String(item.label ?? "").trim();
      if (!CASE_TYPE_KEY_PATTERN.test(key)) {
        throw new Error(`用例类型 key 不合法：${key || "-"}`);
      }
      if (!label) {
        throw new Error(`用例类型 ${key} label 不能为空`);
      }
      if (seen.has(key)) {
        throw new Error(`用例类型 key 重复：${key}`);
      }
      seen.add(key);
      const description = item.description?.trim();
      result.push({
        key,
        label,
        enabled: key === defaultCaseType.key ? true : item.enabled !== false,
        sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 0,
        ...(description ? { description } : {})
      });
    }
    if (!seen.has(defaultCaseType.key)) {
      throw new Error("默认类型 uncategorized 不可删除");
    }
    return result.sort((left, right) => left.sort - right.sort || left.key.localeCompare(right.key));
  }

  private async collectReferencedCaseTypes(): Promise<Set<string>> {
    const scenarioDir = path.resolve(this.rootDir, "cases", "scenario");
    const files = await fs.readdir(scenarioDir, { withFileTypes: true }).catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
    const referenced = new Set<string>();
    for (const entry of files) {
      if (!entry.isFile() || !/\.(ya?ml)$/i.test(entry.name)) {
        continue;
      }
      const filePath = path.resolve(scenarioDir, entry.name);
      const content = await fs.readFile(filePath, "utf8");
      const validation = await validateScenarioContentForRun(this.rootDir, content);
      const fallback = readCaseType(content);
      referenced.add(validation.data?.case_type ?? fallback ?? defaultCaseType.key);
    }
    return referenced;
  }

  private async readConfigObject(configPath: string): Promise<Record<string, unknown>> {
    const content = await fs.readFile(configPath, "utf8").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return "{}";
      }
      throw error;
    });
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  }
}

function readCaseType(content: string): string | undefined {
  let raw: unknown;
  try {
    raw = YAML.parse(content) as unknown;
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const value = (raw as Record<string, unknown>).case_type ?? (raw as Record<string, unknown>).caseType;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

import YAML from "yaml";
import { scenarioCaseSchema, type ScenarioCase } from "@ai-e2e/shared";

export function parseGeneratedScenarioYaml(content: string): ScenarioCase {
  const parsed = scenarioCaseSchema.safeParse(YAML.parse(content));
  if (!parsed.success) {
    throw new Error(`AI 生成的 scenario DSL 校验失败：${parsed.error.message}`);
  }
  return parsed.data;
}

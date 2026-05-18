import YAML from "yaml";
import { locationMapSchema, type LocationMap } from "@ai-e2e/shared";

export function parseGeneratedLocationYaml(content: string): LocationMap {
  const parsed = locationMapSchema.safeParse(YAML.parse(content));
  if (!parsed.success) {
    throw new Error(`AI 生成的 location DSL 校验失败：${parsed.error.message}`);
  }
  return parsed.data;
}

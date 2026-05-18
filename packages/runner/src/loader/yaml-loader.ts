import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export async function loadYamlFile<T>(filePath: string): Promise<T> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, "utf8");
  return YAML.parse(content) as T;
}

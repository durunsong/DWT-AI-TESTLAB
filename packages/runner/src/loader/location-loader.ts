import path from "node:path";
import { locationMapSchema, type LocationMap } from "@ai-e2e/shared";
import { loadYamlFile } from "./yaml-loader";

export class LocationLoader {
  constructor(private readonly rootDir: string) {}

  async load(locationFile: string): Promise<LocationMap> {
    const raw = await loadYamlFile<unknown>(path.resolve(this.rootDir, locationFile));
    const parsed = locationMapSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`定位文件校验失败：${locationFile}\n${parsed.error.message}`);
    }
    return parsed.data;
  }
}

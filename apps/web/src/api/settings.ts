import { request } from "./request";
import type { EnvFileConfig, EnvVariable, TestEnv } from "../types/settings";

export function listEnvFiles(): Promise<EnvFileConfig[]> {
  return request.get<unknown, EnvFileConfig[]>("/settings/env-files");
}

export function getEnvFile(env: TestEnv): Promise<EnvFileConfig> {
  return request.get<unknown, EnvFileConfig>(`/settings/env-files/${env}`);
}

export function saveEnvFile(env: TestEnv, variables: Array<Pick<EnvVariable, "key" | "value" | "comment">>): Promise<EnvFileConfig> {
  return request.put<unknown, EnvFileConfig>(`/settings/env-files/${env}`, { variables });
}

export function importEnvFile(env: TestEnv, content: string): Promise<EnvFileConfig> {
  return request.post<unknown, EnvFileConfig>(`/settings/env-files/${env}/import`, { content });
}

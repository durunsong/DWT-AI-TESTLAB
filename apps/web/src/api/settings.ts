import { request } from "./request";
import type { CaseTypeConfig, EnvFileConfig, EnvFileContent, EnvVariable, TestEnv } from "../types/settings";

export function listCaseTypes(): Promise<CaseTypeConfig[]> {
  return request.get<unknown, CaseTypeConfig[]>("/settings/case-types");
}

export function saveCaseTypes(caseTypes: CaseTypeConfig[]): Promise<CaseTypeConfig[]> {
  return request.put<unknown, CaseTypeConfig[]>("/settings/case-types", { caseTypes });
}

export function listEnvFiles(): Promise<EnvFileConfig[]> {
  return request.get<unknown, EnvFileConfig[]>("/settings/env-files");
}

export function getEnvFile(env: TestEnv): Promise<EnvFileConfig> {
  return request.get<unknown, EnvFileConfig>(`/settings/env-files/${env}`);
}

export function getEnvFileContent(env: TestEnv): Promise<EnvFileContent> {
  return request.get<unknown, EnvFileContent>(`/settings/env-files/${env}/content`);
}

export function saveEnvFile(env: TestEnv, variables: Array<Pick<EnvVariable, "key" | "value" | "comment">>): Promise<EnvFileConfig> {
  return request.put<unknown, EnvFileConfig>(`/settings/env-files/${env}`, { variables });
}

export function saveEnvFileContent(env: TestEnv, content: string): Promise<EnvFileConfig> {
  return request.put<unknown, EnvFileConfig>(`/settings/env-files/${env}/content`, { content });
}

export function importEnvFile(env: TestEnv, content: string): Promise<EnvFileConfig> {
  return request.post<unknown, EnvFileConfig>(`/settings/env-files/${env}/import`, { content });
}

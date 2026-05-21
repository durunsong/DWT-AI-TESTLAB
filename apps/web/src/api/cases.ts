import { request } from "./request";
import type { CaseDetail, CaseItem, CasePreflightResult, CaseValidationResult, CreateCaseInput, DeleteCaseResult, ImportYamlResult, SaveCaseResult } from "../types/case";

export function listCases(): Promise<CaseItem[]> {
  return request.get<unknown, CaseItem[]>("/cases");
}

export function getCase(caseId: string): Promise<CaseDetail> {
  return request.get<unknown, CaseDetail>(`/cases/${caseId}`);
}

export function createCase(data: CreateCaseInput): Promise<CaseDetail> {
  return request.post<unknown, CaseDetail>("/cases", data);
}

export function importCaseYaml(data: { content: string; caseId?: string }): Promise<ImportYamlResult> {
  return request.post<unknown, ImportYamlResult>("/cases/import-yaml", data);
}

export function saveCase(caseId: string, content: string): Promise<SaveCaseResult> {
  return request.put<unknown, SaveCaseResult>(`/cases/${caseId}`, { content });
}

export function deleteCase(caseId: string): Promise<DeleteCaseResult> {
  return request.delete<unknown, DeleteCaseResult>(`/cases/${caseId}`);
}

export function validateCase(content: string): Promise<CaseValidationResult> {
  return request.post<unknown, CaseValidationResult>("/cases/validate", { content });
}

export function preflightCase(caseId: string, env?: string): Promise<CasePreflightResult> {
  const query = env ? `?env=${encodeURIComponent(env)}` : "";
  return request.get<unknown, CasePreflightResult>(`/cases/${caseId}/preflight${query}`);
}

export function preflightCaseContent(content: string, env?: string): Promise<CasePreflightResult> {
  return request.post<unknown, CasePreflightResult>("/cases/preflight", { content, env });
}

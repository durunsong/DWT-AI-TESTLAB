import { request } from "./request";
import { apiUrl } from "./base-url";
import type { CaseAttachmentSearchResult, CaseAttachmentResult, CaseDetail, CaseItem, CasePreflightResult, CaseValidationResult, CreateCaseInput, DeleteAttachmentResult, DeleteCaseResult, ImportYamlResult, SaveCaseResult, SharedAbility } from "../types/case";

export function listCases(): Promise<CaseItem[]> {
  return request.get<unknown, CaseItem[]>("/cases");
}

export function listSharedAbilities(): Promise<SharedAbility[]> {
  return request.get<unknown, SharedAbility[]>("/cases/shared-abilities");
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

export function normalizeCaseYaml(content: string): Promise<string> {
  return request.post<unknown, string>("/cases/normalize-yaml", { content });
}

export function uploadCaseAttachment(data: {
  caseId: string;
  fileName: string;
  mimeType?: string;
  base64: string;
}): Promise<CaseAttachmentResult> {
  return request.post<unknown, CaseAttachmentResult>("/cases/attachments", data);
}

export function listCaseAttachments(caseId: string): Promise<CaseAttachmentResult[]> {
  return request.get<unknown, CaseAttachmentResult[]>(`/cases/${caseId}/attachments`);
}

export function searchCaseAttachments(params: { caseId?: string; query?: string; limit?: number }): Promise<CaseAttachmentSearchResult[]> {
  const query = new URLSearchParams();
  if (params.caseId) query.set("caseId", params.caseId);
  if (params.query) query.set("query", params.query);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  return request.get<unknown, CaseAttachmentSearchResult[]>(`/cases/attachments/search${suffix}`);
}

export function deleteCaseAttachment(caseId: string, file: string): Promise<DeleteAttachmentResult> {
  return request.delete<unknown, DeleteAttachmentResult>(`/cases/${caseId}/attachments?file=${encodeURIComponent(file)}`);
}

export function caseAttachmentFileUrl(file: string, options?: { download?: boolean }): string {
  const query = new URLSearchParams({ file });
  if (options?.download) {
    query.set("download", "true");
  }
  return apiUrl(`/cases/attachments/file?${query}`);
}

export function saveCase(caseId: string, content: string): Promise<SaveCaseResult> {
  return request.put<unknown, SaveCaseResult>(`/cases/${caseId}`, { content });
}

export function deleteCase(caseId: string, options?: { deleteAttachments?: boolean }): Promise<DeleteCaseResult> {
  const query = options?.deleteAttachments ? "?deleteAttachments=true" : "";
  return request.delete<unknown, DeleteCaseResult>(`/cases/${caseId}${query}`);
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

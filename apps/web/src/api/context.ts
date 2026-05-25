import { request } from "./request";
import type { AppAuthSourceSummary, AppContextOverview, AppContextSourceDetail, AppContextSummary, DbHealthResult } from "../types/context";

export function getAppContext(): Promise<AppContextSummary> {
  return request.get<unknown, AppContextSummary>("/app/context");
}

export function getAppContextOverview(): Promise<AppContextOverview> {
  return request.get<unknown, AppContextOverview>("/app/context/overview");
}

export function parseAppContextSource(input: { source: string; fileName: string; content: string }): Promise<AppAuthSourceSummary> {
  return request.post<unknown, AppAuthSourceSummary>("/app/context/parse", input);
}

export function getAppContextSource(source: string): Promise<AppContextSourceDetail> {
  return request.get<unknown, AppContextSourceDetail>(`/app/context/sources/${source}`);
}

export function saveAppContextSource(input: { source: string; fileName: string; content: string }): Promise<AppContextSourceDetail> {
  return request.put<unknown, AppContextSourceDetail>(`/app/context/sources/${input.source}`, {
    fileName: input.fileName,
    content: input.content
  });
}

export function deleteAppContextSource(source: string): Promise<AppContextSummary> {
  return request.delete<unknown, AppContextSummary>(`/app/context/sources/${source}`);
}

export function getDbHealth(): Promise<DbHealthResult> {
  return request.get<unknown, DbHealthResult>("/db/health");
}

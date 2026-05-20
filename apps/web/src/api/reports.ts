import { request } from "./request";
import type { ArtifactKind, ArtifactSummary, ClearArtifactsResult, DeleteRunHistoryResult, RunHistoryItem, RunReport } from "../types/report";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export function getTestRunReport(runId: string): Promise<RunReport | null> {
  return request.get<unknown, RunReport | null>(`/test-runs/${runId}/report`);
}

export async function listRunHistory(): Promise<RunHistoryItem[]> {
  const result = await request.get<unknown, RunHistoryItem[] | ApiResponse<RunHistoryItem[]>>("/test-runs/history");
  return toArray(result);
}

export async function getArtifactSummaries(): Promise<ArtifactSummary[]> {
  const result = await request.get<unknown, ArtifactSummary[] | ApiResponse<ArtifactSummary[]>>("/artifacts");
  return toArray(result);
}

export async function clearArtifacts(kinds?: ArtifactKind[]): Promise<ClearArtifactsResult> {
  const result = await request.post<unknown, ClearArtifactsResult | ApiResponse<ClearArtifactsResult>>("/artifacts/clear", { kinds });
  const data = unwrapResponse(result);
  return {
    ...data,
    cleared: toArray(data.cleared),
    remaining: toArray(data.remaining)
  };
}

export function deleteRunHistory(runId: string): Promise<DeleteRunHistoryResult> {
  return request.delete<unknown, DeleteRunHistoryResult>(`/test-runs/history/${runId}`);
}

function unwrapResponse<T>(value: T | ApiResponse<T>): T {
  if (isApiResponse<T>(value)) {
    return value.data;
  }
  return value;
}

function toArray<T>(value: T[] | ApiResponse<T[]> | null | undefined): T[] {
  const data = unwrapResponse(value);
  return Array.isArray(data) ? data : [];
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(value && typeof value === "object" && "code" in value && "data" in value);
}

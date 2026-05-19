import { request } from "./request";
import type { ArtifactKind, ArtifactSummary, ClearArtifactsResult, DeleteRunHistoryResult, RunHistoryItem, RunReport } from "../types/report";

export function getTestRunReport(runId: string): Promise<RunReport> {
  return request.get<unknown, RunReport>(`/test-runs/${runId}/report`);
}

export function listRunHistory(): Promise<RunHistoryItem[]> {
  return request.get<unknown, RunHistoryItem[]>("/test-runs/history");
}

export function getArtifactSummaries(): Promise<ArtifactSummary[]> {
  return request.get<unknown, ArtifactSummary[]>("/artifacts");
}

export function clearArtifacts(kinds?: ArtifactKind[]): Promise<ClearArtifactsResult> {
  return request.post<unknown, ClearArtifactsResult>("/artifacts/clear", { kinds });
}

export function deleteRunHistory(runId: string): Promise<DeleteRunHistoryResult> {
  return request.delete<unknown, DeleteRunHistoryResult>(`/test-runs/history/${runId}`);
}

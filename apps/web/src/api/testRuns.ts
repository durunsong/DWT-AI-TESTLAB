import { request } from "./request";
import { apiUrl } from "./base-url";
import type { BatchTestRunSummary, CreateBatchTestRunParams, CreateBatchTestRunResponse, CreateTestRunParams, CreateTestRunResponse, TestRunSummary } from "../types/run";

export function createTestRun(data: CreateTestRunParams): Promise<CreateTestRunResponse> {
  return request.post<unknown, CreateTestRunResponse>("/test-runs", data);
}

export function createBatchTestRun(data: CreateBatchTestRunParams): Promise<CreateBatchTestRunResponse> {
  return request.post<unknown, CreateBatchTestRunResponse>("/test-runs/batch", data);
}

export function getBatchTestRun(batchId: string): Promise<BatchTestRunSummary | null> {
  return request.get<unknown, BatchTestRunSummary | null>(`/test-runs/batch/${batchId}`);
}

export function getTestRun(runId: string): Promise<TestRunSummary | null> {
  return request.get<unknown, TestRunSummary | null>(`/test-runs/${runId}`);
}

export function getTestRunLogs(runId: string): Promise<string> {
  return request.get<unknown, string>(`/test-runs/${runId}/logs`);
}

export function eventSourceUrl(runId: string): string {
  return apiUrl(`/test-runs/${runId}/events`);
}

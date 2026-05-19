import { request } from "./request";
import type { DbHealthResult, DowaletContextSummary } from "../types/context";

export function getDowaletContext(): Promise<DowaletContextSummary> {
  return request.get<unknown, DowaletContextSummary>("/dowalet/context");
}

export function getDbHealth(): Promise<DbHealthResult> {
  return request.get<unknown, DbHealthResult>("/db/health");
}

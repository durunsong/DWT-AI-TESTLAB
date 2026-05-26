import { buildReportModePath, type ReportLinkMode } from "../../components/report-links";

export function buildBatchReportDetailPath(options: { runId?: string; fallbackRunId?: string }): string {
  return `/reports/${options.runId || options.fallbackRunId || "latest"}`;
}

export function buildBatchReportModePath(
  mode: ReportLinkMode,
  options: { runId?: string; fallbackRunId?: string }
): string {
  return buildReportModePath(mode, options.runId || options.fallbackRunId || "latest");
}

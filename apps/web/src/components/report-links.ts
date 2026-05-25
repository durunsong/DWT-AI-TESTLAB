export type ReportLinkMode = "html" | "json" | "screenshots" | "logs" | "traces" | "videos" | "ai-analysis";

export function buildReportModePath(mode: ReportLinkMode, runId: string): string {
  return `/reports/${runId}?mode=${mode}`;
}

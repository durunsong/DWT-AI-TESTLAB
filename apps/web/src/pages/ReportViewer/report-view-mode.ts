export type ReportViewMode = "overview" | "html" | "json" | "screenshots" | "logs" | "traces" | "videos" | "ai-analysis";

export function readReportViewMode(mode: string | null): ReportViewMode {
  if (mode === "html" || mode === "json" || mode === "screenshots" || mode === "logs" || mode === "traces" || mode === "videos" || mode === "ai-analysis") {
    return mode;
  }
  return "overview";
}

import fs from "node:fs/promises";
import { maskSensitive, type RunReport } from "@ai-e2e/shared";

export class HtmlReportBuilder {
  async write(reportPath: string, report: RunReport): Promise<void> {
    const safeReport = maskSensitive(report);
    const rows = safeReport.steps
      .map(
        (step, index) => `<tr class="${step.status}">
          <td>${index + 1}</td><td>${escapeHtml(step.stepId)}</td><td>${escapeHtml(step.name)}</td>
          <td>${step.type}</td><td>${step.session ?? ""}</td><td>${step.status}</td>
          <td>${step.durationMs ?? ""}</td><td>${escapeHtml(step.error ?? "")}</td>
        </tr>`
      )
      .join("");
    await fs.writeFile(
      reportPath,
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(safeReport.caseName)}</title>
      <style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;color:#172033}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left}.passed{background:#f0fdf4}.failed{background:#fef2f2}.running{background:#eff6ff}</style></head>
      <body><h1>${escapeHtml(safeReport.caseName)}</h1><p>runId: ${safeReport.runId} · env: ${safeReport.env} · status: ${safeReport.status}</p>
      <p>total: ${safeReport.total}, passed: ${safeReport.passed}, failed: ${safeReport.failed}, skipped: ${safeReport.skipped}</p>
      <table><thead><tr><th>#</th><th>stepId</th><th>名称</th><th>类型</th><th>会话</th><th>状态</th><th>耗时(ms)</th><th>错误</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
      "utf8"
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

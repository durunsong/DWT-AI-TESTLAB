import fs from "node:fs/promises";
import { maskSensitive, type RunReport } from "@ai-e2e/shared";

export class HtmlReportBuilder {
  async write(reportPath: string, report: RunReport): Promise<void> {
    const safeReport = maskSensitive(report);
    const rows = safeReport.steps
      .map(
        (step, index) => `<tr class="row-${step.status}">
          <td class="index-cell">${index + 1}</td>
          <td><code>${escapeHtml(step.stepId)}</code></td>
          <td>${escapeHtml(step.name)}</td>
          <td><span class="soft-pill">${escapeHtml(step.type)}</span></td>
          <td>${escapeHtml(step.session ?? "-")}</td>
          <td><span class="status status-${step.status}">${escapeHtml(statusText(step.status))}</span></td>
          <td>${step.durationMs ? `${step.durationMs} ms` : "-"}</td>
          <td class="data-cell">${escapeHtml(formatData(step.data))}</td>
          <td class="error-cell">${escapeHtml(step.error ?? "-")}</td>
        </tr>`
      )
      .join("");
    await fs.writeFile(
      reportPath,
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(safeReport.caseName)}</title>
      <style>
      :root{color-scheme:light;--border:#d8e0ec;--muted:#64748b;--text:#0f172a;--panel:#fff;--bg:#f3f6fa;--ok:#16a34a;--bad:#dc2626;--warn:#d97706}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .page{padding:18px}.hero,.table-card{border:1px solid var(--border);border-radius:10px;background:var(--panel);box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .hero{padding:20px 22px}.hero-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.title{min-width:0}h1{margin:0;font-size:26px;line-height:1.25}.meta{margin:8px 0 0;color:var(--muted);overflow-wrap:anywhere}
      .status{display:inline-flex;align-items:center;border:1px solid #dbe3ef;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}.status-passed{border-color:#86efac;background:#f0fdf4;color:#15803d}.status-failed{border-color:#fecaca;background:#fef2f2;color:#b91c1c}.status-running{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}.status-skipped,.status-pending{background:#f8fafc;color:#64748b}
      .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}.stat{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px}.stat span{display:block;color:var(--muted);font-size:12px}.stat strong{display:block;margin-top:4px;font-size:20px;line-height:1.2}
      .table-card{margin-top:16px;padding:14px 16px 16px}.table-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.table-title h2{margin:0;font-size:17px}.table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
      table{width:100%;min-width:1240px;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #edf1f7;padding:11px 12px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f8fafc;color:#475569;font-size:12px;font-weight:700}.index-cell{color:#64748b;width:54px}code{border-radius:5px;background:#eef2f7;padding:2px 5px;color:#0f172a;font-family:"SFMono-Regular",Consolas,monospace;font-size:12px}.soft-pill{display:inline-flex;border-radius:6px;background:#eef2ff;padding:2px 7px;color:#3730a3;font-size:12px}
      .row-passed{background:#f0fdf4}.row-failed{background:#fef2f2}.row-skipped{background:#fff}.error-cell{color:#b91c1c;white-space:pre-wrap}.data-cell{color:#475569;font:12px/1.5 "SFMono-Regular",Consolas,monospace;white-space:pre-wrap}
      col.c-index{width:54px}col.c-step{width:230px}col.c-name{width:220px}col.c-type{width:150px}col.c-session{width:90px}col.c-status{width:110px}col.c-duration{width:110px}col.c-data{width:180px}
      </style></head>
      <body><main class="page"><section class="hero"><div class="hero-head"><div class="title"><h1>${escapeHtml(safeReport.caseName)}</h1><p class="meta">runId: ${escapeHtml(safeReport.runId)} · env: ${escapeHtml(safeReport.env)}</p></div><span class="status status-${safeReport.status}">${escapeHtml(statusText(safeReport.status))}</span></div>
      <div class="stats"><div class="stat"><span>总步骤</span><strong>${safeReport.total}</strong></div><div class="stat"><span>成功</span><strong>${safeReport.passed}</strong></div><div class="stat"><span>失败</span><strong>${safeReport.failed}</strong></div><div class="stat"><span>跳过</span><strong>${safeReport.skipped}</strong></div></div></section>
      <section class="table-card"><div class="table-title"><h2>步骤明细</h2><span class="meta">${safeReport.endedAt ? escapeHtml(safeReport.endedAt) : ""}</span></div>
      <div class="table-wrap"><table><colgroup><col class="c-index"><col class="c-step"><col class="c-name"><col class="c-type"><col class="c-session"><col class="c-status"><col class="c-duration"><col class="c-data"><col></colgroup><thead><tr><th>#</th><th>stepId</th><th>名称</th><th>类型</th><th>会话</th><th>状态</th><th>耗时</th><th>数据</th><th>错误</th></tr></thead><tbody>${rows}</tbody></table></div></section></main></body></html>`,
      "utf8"
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function formatData(value: unknown): string {
  if (value === undefined) {
    return "-";
  }
  return JSON.stringify(value, null, 2);
}

function statusText(status: string): string {
  return ({ pending: "待执行", running: "执行中", passed: "成功", failed: "失败", skipped: "跳过" } as Record<string, string>)[status] ?? status;
}

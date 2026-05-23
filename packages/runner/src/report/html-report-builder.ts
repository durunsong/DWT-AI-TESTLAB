import fs from "node:fs/promises";
import { maskSensitive, type RunReport } from "@ai-e2e/shared";

interface DetailEntry {
  id: string;
  title: string;
  content: string;
  danger?: boolean;
}

export class HtmlReportBuilder {
  async write(reportPath: string, report: RunReport): Promise<void> {
    const safeReport = maskSensitive(report);
    const details: DetailEntry[] = [];
    const rows = safeReport.steps.map((step, index) => renderStepRow(step, index, details)).join("");
    const detailJson = escapeScriptJson(JSON.stringify(details));

    await fs.writeFile(
      reportPath,
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(safeReport.caseName)}</title><link rel="icon" href="data:,">
      <style>
      :root{color-scheme:light;--border:#d8e0ec;--muted:#64748b;--text:#0f172a;--panel:#fff;--bg:#f3f6fa;--ok:#16a34a;--bad:#dc2626;--warn:#d97706}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .page{padding:18px}.hero,.table-card{border:1px solid var(--border);border-radius:10px;background:var(--panel);box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .hero{padding:20px 22px}.hero-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.title{min-width:0}h1{margin:0;font-size:26px;line-height:1.25}.meta{margin:8px 0 0;color:var(--muted);overflow-wrap:anywhere}
      .status{display:inline-flex;align-items:center;border:1px solid #dbe3ef;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}.status-passed{border-color:#86efac;background:#f0fdf4;color:#15803d}.status-failed{border-color:#fecaca;background:#fef2f2;color:#b91c1c}.status-running{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}.status-skipped,.status-pending{background:#f8fafc;color:#64748b}
      .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}.stat{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px}.stat span{display:block;color:var(--muted);font-size:12px}.stat strong{display:block;margin-top:4px;font-size:20px;line-height:1.2}
      .failure-summary{margin-top:12px;border:1px solid #fecaca;border-radius:8px;background:#fff1f2;padding:10px 12px;color:#991b1b;white-space:pre-wrap;overflow-wrap:anywhere}
      .dev-summary{margin-top:14px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;padding:14px 16px}.dev-summary h2{margin:0 0 8px;font-size:17px}.dev-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dev-item{border:1px solid #dbeafe;border-radius:7px;background:#fff;padding:8px 10px}.dev-item span{display:block;color:#64748b;font-size:12px}.dev-item strong{display:block;margin-top:2px;color:#0f172a}.dev-list{margin:8px 0 0;padding-left:18px;color:#334155}
      .table-card{margin-top:16px;padding:14px 16px 16px}.table-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.table-title h2{margin:0;font-size:17px}.table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
      table{width:100%;min-width:1360px;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #edf1f7;padding:11px 12px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{position:sticky;top:0;z-index:1;background:#f8fafc;color:#475569;font-size:12px;font-weight:700}.index-cell{color:#64748b;width:54px}code{border-radius:5px;background:#eef2f7;padding:2px 5px;color:#0f172a;font-family:"SFMono-Regular",Consolas,monospace;font-size:12px}.soft-pill{display:inline-flex;border-radius:6px;background:#eef2ff;padding:2px 7px;color:#3730a3;font-size:12px}
      .row-passed{background:#f0fdf4}.row-failed{background:#fff1f2}.row-skipped{background:#fff}.error-cell{color:#b91c1c}.data-cell{color:#475569}.detail-cell{display:flex;max-width:100%;align-items:center;gap:8px;font:12px/1.5 "SFMono-Regular",Consolas,monospace}.detail-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.detail-button{flex:0 0 auto;border:0;background:transparent;color:#2563eb;cursor:pointer;font:12px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0}.detail-button:hover{text-decoration:underline}.empty-cell{color:#94a3b8}
      .modal-mask{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.42);padding:24px}.modal-mask.is-open{display:flex}.modal{width:min(920px,92vw);max-height:82vh;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:hidden}.modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e2e8f0;padding:14px 16px}.modal-title{margin:0;font-size:16px;line-height:1.4}.modal-close{border:1px solid #d8e0ec;border-radius:6px;background:#fff;color:#334155;cursor:pointer;padding:4px 10px}.modal-close:hover{background:#f8fafc}.modal-body{padding:14px 16px;overflow:auto}.modal-body pre{margin:0;max-height:64vh;overflow:auto;border-radius:8px;border:1px solid #e2e8f0;background:#0f172a;color:#e2e8f0;padding:12px;white-space:pre-wrap;word-break:break-word;font:12px/1.6 "SFMono-Regular",Consolas,monospace}.modal.is-danger .modal-body pre{border-color:#fecaca;background:#fff7f7;color:#991b1b}
      col.c-index{width:54px}col.c-step{width:230px}col.c-name{width:220px}col.c-type{width:150px}col.c-session{width:90px}col.c-status{width:110px}col.c-duration{width:110px}col.c-data{width:220px}col.c-error{width:376px}
      @media (max-width:1100px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style></head>
      <body><main class="page"><section class="hero"><div class="hero-head"><div class="title"><h1>${escapeHtml(safeReport.caseName)}</h1><p class="meta">runId: ${escapeHtml(safeReport.runId)} · env: ${escapeHtml(safeReport.env)}</p></div><span class="status status-${safeReport.status}">${escapeHtml(statusText(safeReport.status))}</span></div>
      <div class="stats"><div class="stat"><span>总步骤</span><strong>${safeReport.total}</strong></div><div class="stat"><span>成功</span><strong>${safeReport.passed}</strong></div><div class="stat"><span>失败</span><strong>${safeReport.failed}</strong></div><div class="stat"><span>跳过</span><strong>${safeReport.skipped}</strong></div></div>${renderDeveloperSummary(safeReport)}${safeReport.failureSummary ? `<div class="failure-summary">${escapeHtml(safeReport.failureSummary)}</div>` : ""}</section>
      <section class="table-card"><div class="table-title"><h2>步骤明细</h2><span class="meta">${safeReport.endedAt ? escapeHtml(safeReport.endedAt) : ""}</span></div>
      <div class="table-wrap"><table><colgroup><col class="c-index"><col class="c-step"><col class="c-name"><col class="c-type"><col class="c-session"><col class="c-status"><col class="c-duration"><col class="c-data"><col class="c-error"></colgroup><thead><tr><th>#</th><th>stepId</th><th>名称</th><th>类型</th><th>会话</th><th>状态</th><th>耗时</th><th>数据</th><th>错误</th></tr></thead><tbody>${rows}</tbody></table></div></section></main>
      <div class="modal-mask" id="detailModalMask" aria-hidden="true" inert><section class="modal" id="detailModal" role="dialog" aria-modal="true" aria-labelledby="detailModalTitle"><div class="modal-head"><h3 class="modal-title" id="detailModalTitle">详情</h3><button class="modal-close" type="button" id="detailModalClose">关闭</button></div><div class="modal-body"><pre id="detailModalContent"></pre></div></section></div>
      <script id="detailPayload" type="application/json">${detailJson}</script>
      <script>
      (() => {
        const details = JSON.parse(document.getElementById("detailPayload").textContent || "[]");
        const detailMap = new Map(details.map((item) => [item.id, item]));
        const mask = document.getElementById("detailModalMask");
        const modal = document.getElementById("detailModal");
        const title = document.getElementById("detailModalTitle");
        const content = document.getElementById("detailModalContent");
        let activeTrigger = null;
        const close = () => {
          if (activeTrigger && document.contains(activeTrigger)) {
            activeTrigger.focus();
          } else if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          mask.classList.remove("is-open");
          mask.setAttribute("aria-hidden", "true");
          mask.setAttribute("inert", "");
        };
        document.addEventListener("click", (event) => {
          const button = event.target.closest("[data-detail-id]");
          if (!button) return;
          const detail = detailMap.get(button.getAttribute("data-detail-id"));
          if (!detail) return;
          activeTrigger = button;
          title.textContent = detail.title;
          content.textContent = detail.content;
          modal.classList.toggle("is-danger", Boolean(detail.danger));
          mask.removeAttribute("inert");
          mask.classList.add("is-open");
          mask.setAttribute("aria-hidden", "false");
          document.getElementById("detailModalClose").focus();
        });
        document.getElementById("detailModalClose").addEventListener("click", close);
        mask.addEventListener("click", (event) => {
          if (event.target === mask) close();
        });
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") close();
        });
      })();
      </script></body></html>`,
      "utf8"
    );
  }
}

function renderDeveloperSummary(report: RunReport): string {
  const summary = report.developerSummary;
  if (!summary) {
    return "";
  }
  const evidence = summary.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const reproduce = summary.reproduce.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="dev-summary"><h2>开发处理摘要</h2><div class="dev-grid">
    <div class="dev-item"><span>归因建议</span><strong>${escapeHtml(summary.title)}</strong></div>
    <div class="dev-item"><span>建议处理人</span><strong>${escapeHtml(ownerText(summary.ownerHint))}</strong></div>
    <div class="dev-item"><span>失败步骤</span><strong>${escapeHtml(summary.failedStepId)} / ${escapeHtml(summary.failedStepType)}</strong></div>
    <div class="dev-item"><span>建议动作</span><strong>${escapeHtml(summary.suggestedAction)}</strong></div>
  </div><div class="dev-grid" style="margin-top:8px">
    <div class="dev-item"><span>关键证据</span><ul class="dev-list">${evidence}</ul></div>
    <div class="dev-item"><span>复现方式</span><ul class="dev-list">${reproduce}</ul></div>
  </div></section>`;
}

function ownerText(owner: string): string {
  return ({ frontend: "前端开发", backend: "后端开发", test: "测试/自动化", environment: "环境/数据负责人", unknown: "待确认" } as Record<string, string>)[owner] ?? owner;
}

function renderStepRow(step: RunReport["steps"][number], index: number, details: DetailEntry[]): string {
  const dataText = formatData(step.data);
  const errorText = step.error ?? "";
  const dataDetail = step.data === undefined ? undefined : addDetail(details, `步骤数据：${step.stepId}`, dataText);
  const errorDetail = errorText ? addDetail(details, `错误详情：${step.stepId}`, errorText, true) : undefined;

  return `<tr class="row-${step.status}">
          <td class="index-cell">${index + 1}</td>
          <td><code>${escapeHtml(step.stepId)}</code></td>
          <td>${escapeHtml(step.name)}</td>
          <td><span class="soft-pill">${escapeHtml(step.type)}</span></td>
          <td>${escapeHtml(step.session ?? "-")}</td>
          <td><span class="status status-${step.status}">${escapeHtml(statusText(step.status))}</span></td>
          <td>${step.durationMs ? `${step.durationMs} ms` : "-"}</td>
          <td class="data-cell">${renderDetailCell(dataText, dataDetail, "详情")}</td>
          <td class="error-cell">${renderDetailCell(errorText, errorDetail, "详情", true)}</td>
        </tr>`;
}

function addDetail(details: DetailEntry[], title: string, content: string, danger = false): DetailEntry {
  const entry = { id: `detail_${details.length}`, title, content, danger };
  details.push(entry);
  return entry;
}

function renderDetailCell(content: string, detail: DetailEntry | undefined, label: string, danger = false): string {
  if (!detail) {
    return `<span class="empty-cell">-</span>`;
  }
  return `<span class="detail-cell${danger ? " is-danger" : ""}"><span class="detail-preview">${escapeHtml(compactPreview(content))}</span><button class="detail-button" type="button" data-detail-id="${escapeHtml(detail.id)}">${escapeHtml(label)}</button></span>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003C").replace(/>/g, "\\u003E").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function formatData(value: unknown): string {
  if (value === undefined) {
    return "-";
  }
  return JSON.stringify(value, null, 2);
}

function compactPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 72)}...`;
}

function statusText(status: string): string {
  return ({ pending: "待执行", running: "执行中", passed: "成功", failed: "失败", skipped: "跳过" } as Record<string, string>)[status] ?? status;
}

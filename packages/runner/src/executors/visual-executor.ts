import type { Locator, Page } from "playwright";
import type { ScenarioStep, StepStatus } from "@ai-e2e/shared";

export class VisualExecutor {
  constructor(private readonly enabled: boolean) {}

  async ensure(page: Page): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await page.addStyleTag({
      content: `
        #ai-e2e-pointer,#ai-e2e-highlight,#ai-e2e-step-panel,.ai-e2e-ripple{pointer-events:none}
        #ai-e2e-pointer{position:fixed;width:34px;height:42px;z-index:2147483647;filter:drop-shadow(0 10px 14px rgba(37,99,235,.35));transform:translate(-7px,-5px);transition:left .25s ease,top .25s ease}
        #ai-e2e-pointer::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,#2563eb 0%,#7c3aed 58%,#ec4899 100%);clip-path:polygon(0 0,0 34px,10px 26px,17px 42px,26px 38px,19px 22px,32px 22px)}
        #ai-e2e-pointer::after{content:"";position:absolute;inset:3px;background:#ffffff;clip-path:polygon(0 0,0 27px,8px 20px,14px 34px,19px 32px,13px 18px,24px 18px);opacity:.96}
        #ai-e2e-highlight{position:fixed;z-index:2147483645;border:3px solid #f59e0b;border-radius:8px;box-shadow:0 0 0 4px rgba(245,158,11,.18);transition:all .18s ease}
        #ai-e2e-step-panel{position:fixed;right:18px;bottom:18px;z-index:2147483646;max-width:360px;padding:12px 14px;border-radius:8px;background:rgba(17,24,39,.92);color:white;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.26)}
        #ai-e2e-step-panel strong{display:block;margin-bottom:4px;color:#f8fafc}
        #ai-e2e-step-panel span{color:#cbd5e1}
        .ai-e2e-ripple{position:fixed;z-index:2147483646;width:10px;height:10px;border-radius:999px;border:3px solid #38bdf8;animation:aiE2eRipple .55s ease-out forwards}
        @keyframes aiE2eRipple{to{opacity:0;transform:scale(8)}}
      `
    }).catch(() => undefined);
    await page.evaluate(() => {
      if (!document.getElementById("ai-e2e-pointer")) {
        const pointer = document.createElement("div");
        pointer.id = "ai-e2e-pointer";
        pointer.style.left = "24px";
        pointer.style.top = "24px";
        document.body.appendChild(pointer);
      }
      if (!document.getElementById("ai-e2e-highlight")) {
        const highlight = document.createElement("div");
        highlight.id = "ai-e2e-highlight";
        highlight.style.display = "none";
        document.body.appendChild(highlight);
      }
      if (!document.getElementById("ai-e2e-step-panel")) {
        const panel = document.createElement("div");
        panel.id = "ai-e2e-step-panel";
        document.body.appendChild(panel);
      }
    }).catch(() => undefined);
  }

  async updateStep(page: Page, step: ScenarioStep, status: StepStatus): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.ensure(page);
    await page.evaluate(
      ({ name, type, session, statusText }) => {
        const panel = document.getElementById("ai-e2e-step-panel");
        if (panel) {
          const title = document.createElement("strong");
          title.textContent = name;
          const meta = document.createElement("span");
          meta.textContent = `${type} · ${session ?? "-"} · ${statusText}`;
          panel.replaceChildren(title, meta);
        }
      },
      { name: step.name, type: step.type, session: step.session, statusText: status }
    ).catch(() => undefined);
  }

  async highlight(page: Page, locator: Locator, status: StepStatus = "running"): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.ensure(page);
    const box = await locator.boundingBox().catch(() => null);
    if (!box) {
      return;
    }
    const color = status === "failed" ? "#ef4444" : status === "passed" ? "#22c55e" : "#f59e0b";
    await page.evaluate(
      ({ x, y, width, height, colorValue }) => {
        const highlight = document.getElementById("ai-e2e-highlight");
        const pointer = document.getElementById("ai-e2e-pointer");
        if (highlight) {
          highlight.style.display = "block";
          highlight.style.left = `${x}px`;
          highlight.style.top = `${y}px`;
          highlight.style.width = `${width}px`;
          highlight.style.height = `${height}px`;
          highlight.style.borderColor = colorValue;
        }
        if (pointer) {
          pointer.style.left = `${x + width / 2}px`;
          pointer.style.top = `${y + height / 2}px`;
        }
      },
      { ...box, colorValue: color }
    ).catch(() => undefined);
  }

  async clickRipple(page: Page, locator: Locator): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const box = await locator.boundingBox().catch(() => null);
    if (!box) {
      return;
    }
    await page.evaluate(
      ({ x, y, width, height }) => {
        const ripple = document.createElement("div");
        ripple.className = "ai-e2e-ripple";
        ripple.style.left = `${x + width / 2}px`;
        ripple.style.top = `${y + height / 2}px`;
        document.body.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 650);
      },
      box
    ).catch(() => undefined);
  }
}

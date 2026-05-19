import path from "node:path";
import type { Locator, Page } from "playwright";
import {
  resolveVariables,
  type LocationDefinition,
  type LocationMap,
  type ScenarioSession,
  type ScenarioStep,
  type SessionName,
  type StepResult
} from "@ai-e2e/shared";
import type { RuntimeContext } from "../context/runtime-context";
import type { RunLogger } from "../utils/logger";
import { buildLoginStillPendingMessage, isLoginUrl } from "./login-result";
import { createLocatorPlans, type LocatorPlan } from "./locator-candidates";
import type { VisualExecutor } from "./visual-executor";

export class WebExecutor {
  constructor(
    private readonly input: {
      rootDir: string;
      locations: LocationMap;
      context: RuntimeContext;
      logger: RunLogger;
      visual: VisualExecutor;
      screenshotDir: string;
      defaults?: {
        step_timeout_ms?: number;
        wait_for_network?: boolean;
      };
      getPage?: (session: SessionName) => Promise<Page>;
      newPage?: (session: SessionName) => Promise<Page>;
    }
  ) {}

  async execute(page: Page, step: ScenarioStep): Promise<Partial<StepResult>> {
    await this.input.visual.ensure(page);
    await this.input.visual.updateStep(page, step, "running");
    await this.input.logger.info(`开始执行步骤：${step.step_id}`, { step });

    switch (step.type) {
      case "web_open":
        await page.goto(this.resolve(step.url), { waitUntil: "domcontentloaded" });
        await this.waitForNetworkIfNeeded(page, step);
        return { message: `已打开 ${this.resolve(step.url)}` };
      case "web_reload":
        await page.reload({ waitUntil: "domcontentloaded" });
        await this.waitForNetworkIfNeeded(page, step);
        return { message: "页面已刷新" };
      case "web_click":
        await this.click(page, step);
        await this.waitForNetworkIfNeeded(page, step);
        return { message: "点击完成" };
      case "web_input":
        await this.inputText(page, step);
        return { message: "输入完成" };
      case "web_upload":
        await this.upload(page, step);
        return { message: "上传完成" };
      case "web_wait_text":
        await (await this.locator(page, step)).filter({ hasText: this.resolve(this.stringField(step.expected, "expected")) }).waitFor({ timeout: this.timeoutMs(step) });
        return { message: `已等待文本：${this.resolve(this.stringField(step.expected, "expected"))}` };
      case "web_wait_element":
        await (await this.locator(page, step)).waitFor({ state: "visible", timeout: this.timeoutMs(step) });
        return { message: "元素已出现" };
      case "web_assert_text":
        await this.assertText(page, step);
        return { message: "文本断言通过" };
      case "web_assert_visible": {
        const locator = await this.locator(page, step);
        await locator.waitFor({ state: "visible", timeout: this.timeoutMs(step) });
        await this.input.visual.highlight(page, locator, "passed");
        return { message: "可见性断言通过" };
      }
      case "web_assert_url":
        await page.waitForURL(new RegExp(this.resolve(this.stringField(step.expected, "expected"))), { timeout: this.timeoutMs(step) });
        return { message: "URL 断言通过" };
      case "web_extract":
        await this.extract(page, step);
        return { message: `已提取变量：${step.variable}` };
      case "web_screenshot":
        return { screenshot: await this.screenshot(page, step.step_id), message: "截图完成" };
      case "flow_login":
        await this.flowLogin(page, step);
        return { message: "登录流程已提交" };
      case "flow_submit_kyc":
        await this.flowSubmitKyc(page, step);
        return { message: "KYC 提交流程已提交" };
      case "flow_admin_approve_kyc":
        await this.flowAdminApproveKyc(page, step);
        return { message: "KYC 审核流程已提交" };
      default:
        throw new Error(`P0 暂不支持步骤类型：${step.type}`);
    }
  }

  async captureFailure(page: Page, stepId: string): Promise<Partial<StepResult>> {
    const screenshot = await this.screenshot(page, `${stepId}-failed`);
    return {
      screenshot,
      url: page.url(),
      title: await page.title().catch(() => "")
    };
  }

  private async flowLogin(page: Page, step: ScenarioStep): Promise<void> {
    const prefix = step.session === "admin" ? "admin_login" : "user_login";
    const session = step.session ? this.input.context.state.sessions[step.session] : undefined;
    const username = step.username ?? session?.username;
    const password = step.password ?? session?.password;
    const diagnostics = this.collectLoginDiagnostics(page);
    try {
      const usernameStep = { ...step, target: `${prefix}_username`, value: this.resolve(username) };
      const usernameLocator = await this.locator(page, usernameStep);
      await this.input.visual.highlight(page, usernameLocator);
      await usernameLocator.fill(this.resolve(username), { timeout: this.timeoutMs(step) });
      await this.inputText(page, { ...step, target: `${prefix}_password`, value: this.resolve(password) });
      await this.click(page, { ...step, target: `${prefix}_submit` });
      await this.completeOptionalDeviceVerification(page, step);
      await this.waitForLoginCompleted(page, usernameLocator, step, diagnostics);
    } finally {
      diagnostics.dispose();
    }
  }

  private async completeOptionalDeviceVerification(page: Page, step: ScenarioStep): Promise<void> {
    if (step.session !== "user") {
      return;
    }

    const dialogTitle = page.getByText("设备二次验证", { exact: true });
    const hasVerificationDialog = await dialogTitle.waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasVerificationDialog) {
      return;
    }

    await this.input.logger.info("检测到 user 设备二次验证，准备从 admin 消息中心获取邮箱验证码");
    await page.getByRole("button", { name: "获取验证码" }).click({ timeout: 10_000 });

    const code = await this.fetchLatestAdminMessageVerificationCode();
    await page.bringToFront().catch(() => undefined);
    const codeInput = page.getByPlaceholder("请输入验证码").first();
    await this.input.visual.highlight(page, codeInput);
    await codeInput.fill(code, { timeout: 10_000 });

    await page.getByText(/信任\s*30\s*天/).click({ timeout: 2_000 }).catch(() => undefined);
    const verifyButton = page.getByRole("button", { name: "立即验证" });
    await this.input.visual.highlight(page, verifyButton);
    await verifyButton.click({ timeout: 10_000 });
  }

  private async fetchLatestAdminMessageVerificationCode(): Promise<string> {
    if (!this.input.getPage) {
      throw new Error("user 二次验证需要 admin 会话，但当前执行器未提供会话访问能力");
    }

    const adminSession = this.input.context.state.sessions.admin as ScenarioSession | undefined;
    if (!adminSession?.login_url || !adminSession.username || !adminSession.password) {
      throw new Error("user 二次验证需要配置 admin session 的登录地址、账号和密码");
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const adminPage = await this.openAdminVerificationPage();
        await this.ensureAdminLoggedIn(adminPage, adminSession);
        await adminPage.goto(this.adminMessageUrl(adminSession.login_url), { waitUntil: "domcontentloaded" });
        await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

        const firstEmailRow = adminPage.locator(".el-table__row, tr, [role='row']", { hasText: "邮箱信息" }).first();
        await firstEmailRow.waitFor({ state: "visible", timeout: 10_000 });
        await this.input.visual.highlight(adminPage, firstEmailRow);
        const expandTarget = firstEmailRow.locator(".el-table__expand-icon, [class*='expand'], td, [role='cell']").first();
        await expandTarget.click({ timeout: 10_000 });

        const code = await this.extractVerificationCode(adminPage);
        await this.input.logger.info("已从 admin 消息中心获取 user 二次验证邮箱验证码");
        return code;
      } catch (error) {
        if (attempt < 2 && isTargetClosedError(error)) {
          await this.input.logger.info("admin 会话页面已关闭，重新打开页面后重试获取验证码");
          continue;
        }
        throw error;
      }
    }

    throw new Error("admin 消息中心获取邮箱验证码失败");
  }

  private async openAdminVerificationPage(): Promise<Page> {
    if (this.input.newPage) {
      return this.input.newPage("admin");
    }
    if (this.input.getPage) {
      return this.input.getPage("admin");
    }
    throw new Error("user 二次验证需要 admin 会话，但当前执行器未提供会话访问能力");
  }

  private async ensureAdminLoggedIn(page: Page, adminSession: ScenarioSession): Promise<void> {
    if (!isLoginUrl(page.url()) && page.url() !== "about:blank") {
      return;
    }

    await page.goto(adminSession.login_url, { waitUntil: "domcontentloaded" });
    const usernameStep = { type: "flow_login", target: "admin_login_username", value: adminSession.username } as ScenarioStep;
    const usernameLocator = await this.locator(page, usernameStep);
    await this.input.visual.highlight(page, usernameLocator);
    await usernameLocator.fill(adminSession.username ?? "", { timeout: 10_000 });
    await this.inputText(page, { type: "flow_login", target: "admin_login_password", value: adminSession.password } as ScenarioStep);
    await this.click(page, { type: "flow_login", target: "admin_login_submit" } as ScenarioStep);

    await Promise.race([
      page.waitForURL((url) => !isLoginUrl(url.toString()), { timeout: 15_000 }),
      usernameLocator.waitFor({ state: "hidden", timeout: 15_000 })
    ]).catch(() => undefined);
  }

  private adminMessageUrl(adminLoginUrl: string): string {
    const url = new URL(adminLoginUrl);
    url.hash = "/admin/message";
    return url.toString();
  }

  private async extractVerificationCode(page: Page): Promise<string> {
    const codePattern = /验证码[:：]\s*(\d{4,8})/;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const text = await page.locator("body").innerText({ timeout: 10_000 });
      const match = text.match(codePattern);
      if (match?.[1]) {
        return match[1];
      }
      await page.waitForTimeout(1_000);
    }
    throw new Error("admin 消息中心未找到邮箱验证码");
  }

  private async flowSubmitKyc(page: Page, step: ScenarioStep): Promise<void> {
    await this.optionalInput(page, step, "kyc_enterprise_name", "${var.enterprise_name}");
    await this.optionalInput(page, step, "kyc_license_no", "${var.license_no}");
    await this.optionalInput(page, step, "kyc_legal_person", "${var.legal_person}");
    await this.optionalInput(page, step, "kyc_id_card_no", "${var.id_card_no}");
    await this.optionalUpload(page, step, "kyc_license_upload", process.env.KYC_BUSINESS_LICENSE_FILE);
    await this.click(page, { ...step, target: "kyc_submit" });
  }

  private async flowAdminApproveKyc(page: Page, step: ScenarioStep): Promise<void> {
    await this.optionalInput(page, step, "admin_kyc_search_input", "${var.enterprise_name}");
    await this.optionalClick(page, step, "admin_kyc_search_submit");
    await this.optionalClick(page, step, "admin_kyc_review_button");
    await this.optionalInput(page, step, "admin_kyc_review_remark", "${var.review_remark}");
    await this.click(page, { ...step, target: "admin_kyc_approve_button" });
    await this.optionalClick(page, step, "admin_kyc_confirm");
  }

  private async inputText(page: Page, step: ScenarioStep): Promise<void> {
    const locator = await this.locator(page, step);
    await this.input.visual.highlight(page, locator);
    await locator.fill(this.resolve(step.value), { timeout: this.timeoutMs(step) });
  }

  private async click(page: Page, step: ScenarioStep): Promise<void> {
    const locator = await this.locator(page, step);
    await this.input.visual.highlight(page, locator);
    await this.input.visual.clickRipple(page, locator);
    await locator.click({ timeout: this.timeoutMs(step) });
  }

  private async upload(page: Page, step: ScenarioStep): Promise<void> {
    const locator = await this.locator(page, step);
    await this.input.visual.highlight(page, locator);
    await locator.setInputFiles(path.resolve(this.input.rootDir, this.resolve(step.file)), { timeout: this.timeoutMs(step) });
  }

  private async assertText(page: Page, step: ScenarioStep): Promise<void> {
    const locator = await this.locator(page, step);
    await this.input.visual.highlight(page, locator);
    const expected = this.resolve(this.stringField(step.expected, "expected"));
    const text = (await locator.textContent({ timeout: this.timeoutMs(step) })) ?? "";
    if (!text.includes(expected)) {
      await this.input.visual.highlight(page, locator, "failed");
      throw new Error(`文本断言失败：期望包含「${expected}」，实际为「${text.trim()}」`);
    }
    await this.input.visual.highlight(page, locator, "passed");
  }

  private async extract(page: Page, step: ScenarioStep): Promise<void> {
    if (!step.variable) {
      throw new Error("web_extract 必须指定 variable");
    }
    const value = ((await (await this.locator(page, step)).textContent({ timeout: this.timeoutMs(step) })) ?? "").trim();
    this.input.context.setVariable(step.variable, value);
  }

  private async locator(page: Page, step: ScenarioStep): Promise<Locator> {
    if (!step.target) {
      throw new Error(`${step.type} 必须指定 target`);
    }
    const definition = this.input.locations[step.target];
    if (definition) {
      return this.resolveLocator(page, definition, this.timeoutMs(step));
    }

    return this.resolveInlineTarget(page, step);
  }

  private async resolveInlineTarget(page: Page, step: ScenarioStep): Promise<Locator> {
    const target = this.resolve(step.target);
    const timeoutMs = this.timeoutMs(step);
    const plans = this.inlineTargetPlans(step.type, target);
    const perCandidateTimeout = Math.max(800, Math.min(2_000, Math.floor(timeoutMs / plans.length)));
    const failures: string[] = [];

    for (const plan of plans) {
      const locator = this.buildLocator(page, plan).first();
      try {
        await locator.waitFor({ state: "visible", timeout: perCandidateTimeout });
        await this.input.logger.info(`未找到定位定义，已按页面文案兜底定位：${step.target}`, { stepId: step.step_id, locator: plan });
        return locator;
      } catch {
        failures.push(`${plan.kind}=${plan.value}`);
      }
    }

    throw new Error(`未找到定位定义或可见元素：${step.target}，已尝试：${failures.join(" -> ")}`);
  }

  private inlineTargetPlans(type: ScenarioStep["type"], target: string): LocatorPlan[] {
    const selectorPlan = inlineSelectorPlan(target);
    if (selectorPlan) {
      return [selectorPlan];
    }

    const xpathTarget = xpathLiteral(target);
    const textPlans: LocatorPlan[] = [
      { kind: "text", value: target },
      { kind: "role", value: "button", name: target }
    ];
    if (type === "web_input") {
      return [
        { kind: "label", value: target },
        { kind: "placeholder", value: target },
        {
          kind: "xpath",
          value: `//*[normalize-space()=${xpathTarget}]/ancestor::*[contains(@class,'form-item') or contains(@class,'el-form-item') or self::label][1]//input[not(@type='hidden')]`
        },
        {
          kind: "xpath",
          value: `//*[contains(normalize-space(),${xpathTarget})]/following::input[not(@type='hidden')][1]`
        },
        { kind: "text", value: target },
        { kind: "css", value: `[name="${target}"]` }
      ];
    }
    if (type === "web_upload") {
      return [
        {
          kind: "xpath",
          value: `//*[contains(normalize-space(),${xpathTarget})]/ancestor::*[contains(@class,'upload') or contains(@class,'form-item') or contains(@class,'el-form-item')][1]//input[@type='file']`
        },
        { kind: "text", value: target }
      ];
    }
    return textPlans;
  }

  private async resolveLocator(page: Page, definition: LocationDefinition, timeoutMs: number): Promise<Locator> {
    const plans = createLocatorPlans(definition);
    if (!plans.length) {
      throw new Error("定位定义为空");
    }

    const perCandidateTimeout = Math.max(800, Math.min(2_000, Math.floor(timeoutMs / plans.length)));
    const failures: string[] = [];

    for (const plan of plans) {
      const locator = this.buildLocator(page, plan).first();
      try {
        await locator.waitFor({ state: "visible", timeout: perCandidateTimeout });
        return locator;
      } catch {
        failures.push(`${plan.kind}=${plan.value}`);
      }
    }

    throw new Error(`未找到可见元素，已按优先级尝试：${failures.join(" -> ")}`);
  }

  private buildLocator(page: Page, plan: LocatorPlan): Locator {
    if (plan.kind === "testId") return page.getByTestId(plan.value);
    if (plan.kind === "role") return page.getByRole(plan.value as never, plan.name ? { name: plan.name } : undefined);
    if (plan.kind === "label") return page.getByLabel(plan.value);
    if (plan.kind === "placeholder") return page.getByPlaceholder(plan.value);
    if (plan.kind === "text") return page.getByText(plan.value, { exact: true });
    if (plan.kind === "name") return page.locator(`[name="${plan.value}"]`);
    if (plan.kind === "css") return page.locator(plan.value);
    return page.locator(`xpath=${plan.value}`);
  }

  private async waitForLoginCompleted(page: Page, usernameLocator: Locator, step: ScenarioStep, diagnostics: LoginDiagnostics): Promise<void> {
    const timeoutMs = Number(process.env.FLOW_LOGIN_TIMEOUT_MS ?? step.timeout_ms ?? this.input.defaults?.step_timeout_ms ?? 15_000);
    const startUrl = page.url();

    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 5_000) }).catch(() => undefined);

    const completed = await Promise.race([
      page.waitForURL((url) => url.toString() !== startUrl && !isLoginUrl(url.toString()), { timeout: timeoutMs }).then(() => true),
      usernameLocator.waitFor({ state: "hidden", timeout: timeoutMs }).then(() => true)
    ]).catch(() => false);

    if (completed) {
      return;
    }

    const loginFormStillVisible = await usernameLocator.isVisible().catch(() => false);
    if (loginFormStillVisible || isLoginUrl(page.url())) {
      const detail = diagnostics.summary();
      throw new Error(`${buildLoginStillPendingMessage(step.session, page.url())}${detail ? ` ${detail}` : ""}`);
    }
  }

  private collectLoginDiagnostics(page: Page): LoginDiagnostics {
    const failedResponses: string[] = [];
    const requestFailures: string[] = [];
    const consoleErrors: string[] = [];

    const onResponse = (response: { status: () => number; url: () => string }) => {
      const status = response.status();
      if (status >= 400) {
        failedResponses.push(`${status} ${response.url()}`);
      }
    };
    const onRequestFailed = (request: { url: () => string; failure: () => { errorText: string } | null }) => {
      requestFailures.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`);
    };
    const onConsole = (message: { type: () => string; text: () => string }) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    };

    page.on("response", onResponse);
    page.on("requestfailed", onRequestFailed);
    page.on("console", onConsole);

    return {
      dispose: () => {
        page.off("response", onResponse);
        page.off("requestfailed", onRequestFailed);
        page.off("console", onConsole);
      },
      summary: () => {
        const parts = [
          failedResponses.length ? `失败响应：${failedResponses.slice(0, 3).join("；")}` : "",
          requestFailures.length ? `请求失败：${requestFailures.slice(0, 2).join("；")}` : "",
          consoleErrors.length ? `Console错误：${consoleErrors.slice(0, 2).join("；")}` : ""
        ].filter(Boolean);
        return parts.length ? `诊断信息：${parts.join("。")}` : "";
      }
    };
  }

  private async optionalInput(page: Page, base: ScenarioStep, target: string, value: string): Promise<void> {
    if (!this.input.locations[target]) return;
    await this.inputText(page, { ...base, target, value });
  }

  private async optionalUpload(page: Page, base: ScenarioStep, target: string, value?: string): Promise<void> {
    if (!this.input.locations[target] || !value) return;
    await this.upload(page, { ...base, target, file: value });
  }

  private async optionalClick(page: Page, base: ScenarioStep, target: string): Promise<void> {
    if (!this.input.locations[target]) return;
    await this.click(page, { ...base, target });
  }

  private async screenshot(page: Page, name: string): Promise<string> {
    const filePath = path.resolve(this.input.screenshotDir, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  private timeoutMs(step: ScenarioStep): number {
    return step.timeout_ms ?? this.input.defaults?.step_timeout_ms ?? 10_000;
  }

  private async waitForNetworkIfNeeded(page: Page, step: ScenarioStep): Promise<void> {
    if (!(step.wait_for_network ?? this.input.defaults?.wait_for_network)) {
      return;
    }
    await page.waitForLoadState("networkidle", { timeout: this.timeoutMs(step) }).catch(() => undefined);
  }

  private resolve(value: string | undefined): string {
    return resolveVariables(value, this.input.context.state);
  }

  private stringField(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || typeof value === "string") {
      return value;
    }
    throw new Error(`${fieldName} 必须是字符串`);
  }
}

interface LoginDiagnostics {
  dispose: () => void;
  summary: () => string;
}

function isTargetClosedError(error: unknown): boolean {
  return error instanceof Error && /target page, context or browser has been closed/i.test(error.message);
}

function inlineSelectorPlan(target: string): LocatorPlan | undefined {
  const trimmed = target.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("xpath=")) {
    return { kind: "xpath", value: trimmed.slice("xpath=".length) };
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("(//") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return { kind: "xpath", value: trimmed };
  }
  if (trimmed.startsWith("css=")) {
    return { kind: "css", value: trimmed.slice("css=".length) };
  }
  if (/^[.#\[]/.test(trimmed) || /^[a-z][a-z0-9-]*(?:[.#[:\s>+~]|$)/i.test(trimmed)) {
    return { kind: "css", value: trimmed };
  }
  return undefined;
}

function xpathLiteral(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes("\"")) {
    return `"${value}"`;
  }
  return `concat(${value.split("'").map((part) => `'${part}'`).join(`,"'",`)})`;
}

import fs from "node:fs/promises";
import path from "node:path";
import { ScenarioOrchestrator, validateScenarioContent } from "@ai-e2e/runner";
import YAML from "yaml";

export interface CaseValidationIssue {
  path: string;
  message: string;
}

export interface CaseValidationResult {
  valid: boolean;
  caseId?: string;
  caseName?: string;
  issues: CaseValidationIssue[];
}

export type CaseTemplate = "user_login" | "admin_login" | "user_admin_kyc";

export interface CreateCaseInput {
  caseId: string;
  caseName: string;
  description?: string;
  template: CaseTemplate;
}

export class CaseService {
  constructor(
    _runner: ScenarioOrchestrator,
    private readonly rootDir: string
  ) {}

  async listCases() {
    const files = await this.listScenarioFiles();
    const cases = await Promise.all(
      files.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf8");
        const validation = validateScenarioContent(content);
        const fallbackCaseId = this.caseIdFromFilePath(filePath);
        const parsed = validation.data;

        return {
          caseId: validation.caseId ?? fallbackCaseId,
          caseName: validation.caseName ?? "DSL 校验失败",
          description: parsed?.description,
          mode: parsed?.mode ?? "invalid",
          total: parsed?.steps.length ?? 0,
          valid: validation.valid,
          file: path.relative(this.rootDir, filePath).replace(/\\/g, "/")
        };
      })
    );

    return cases.sort((a, b) => a.caseId.localeCompare(b.caseId));
  }

  async getCase(caseId: string) {
    const filePath = await this.findScenarioPath(caseId);
    const content = await fs.readFile(filePath, "utf8");
    const validation = validateScenarioContent(content);
    const parsed = validation.data;

    return {
      caseId: validation.caseId ?? this.caseIdFromFilePath(filePath),
      caseName: validation.caseName ?? "DSL 校验失败",
      description: parsed?.description,
      mode: parsed?.mode ?? "invalid",
      total: parsed?.steps.length ?? 0,
      file: path.relative(this.rootDir, filePath).replace(/\\/g, "/"),
      content,
      validation
    };
  }

  async createCase(input: CreateCaseInput) {
    const caseId = this.normalizeCaseId(input.caseId);
    const caseName = input.caseName.trim();
    if (!caseId) {
      throw new Error("case_id 不能为空");
    }
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(caseId)) {
      throw new Error("case_id 只能使用小写字母、数字、下划线或中划线，且必须以小写字母开头，长度 3-64 位");
    }
    if (!caseName) {
      throw new Error("用例名称不能为空");
    }

    const files = await this.listScenarioFiles();
    const targetPath = path.resolve(this.scenarioDir(), `${caseId}.yaml`);
    if (!targetPath.startsWith(this.scenarioDir() + path.sep)) {
      throw new Error("用例文件路径非法");
    }
    if (files.some((filePath) => this.caseIdFromFilePath(filePath) === caseId)) {
      throw new Error(`用例文件已存在：${caseId}.yaml`);
    }

    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      const validation = validateScenarioContent(content);
      if (validation.caseId === caseId) {
        throw new Error(`case_id 已存在：${caseId}`);
      }
    }

    const content = this.buildCaseYaml({
      caseId,
      caseName,
      description: input.description?.trim(),
      template: input.template
    });
    const validation = this.validateContent(content);
    if (!validation.valid) {
      throw new Error(`新建用例模板校验失败：${validation.issues.map((item) => `${item.path} ${item.message}`).join("; ")}`);
    }

    const parsed = validateScenarioContent(content).data;
    await fs.writeFile(targetPath, content, "utf8");
    return {
      caseId,
      caseName,
      description: input.description?.trim() || this.defaultDescription(input.template),
      mode: parsed?.mode ?? "web",
      total: parsed?.steps.length ?? 0,
      valid: validation.valid,
      file: path.relative(this.rootDir, targetPath).replace(/\\/g, "/"),
      content,
      validation
    };
  }

  async createCaseFromYaml(content: string, expectedCaseId?: string) {
    const validation = this.validateContent(content);
    if (!validation.valid || !validation.caseId || !validation.caseName) {
      return { saved: false, validation };
    }

    const caseId = this.normalizeCaseId(expectedCaseId || validation.caseId);
    if (caseId !== validation.caseId) {
      return {
        saved: false,
        validation: {
          ...validation,
          valid: false,
          issues: [
            ...validation.issues,
            { path: "case_id", message: `AI YAML 中的 case_id 必须等于 ${caseId}` }
          ]
        }
      };
    }
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(caseId)) {
      return {
        saved: false,
        validation: {
          ...validation,
          valid: false,
          issues: [
            ...validation.issues,
            { path: "case_id", message: "case_id 只能使用小写字母、数字、下划线或中划线，且必须以小写字母开头，长度 3-64 位" }
          ]
        }
      };
    }

    const files = await this.listScenarioFiles();
    if (files.some((filePath) => this.caseIdFromFilePath(filePath) === caseId)) {
      throw new Error(`用例文件已存在：${caseId}.yaml`);
    }
    for (const filePath of files) {
      const existing = validateScenarioContent(await fs.readFile(filePath, "utf8"));
      if (existing.caseId === caseId) {
        throw new Error(`case_id 已存在：${caseId}`);
      }
    }

    const targetPath = path.resolve(this.scenarioDir(), `${caseId}.yaml`);
    if (!targetPath.startsWith(this.scenarioDir() + path.sep)) {
      throw new Error("用例文件路径非法");
    }

    await fs.writeFile(targetPath, this.normalizeContent(content), "utf8");
    const parsed = validateScenarioContent(content).data;
    return {
      saved: true,
      caseId,
      caseName: validation.caseName,
      description: parsed?.description,
      mode: parsed?.mode ?? "web",
      total: parsed?.steps.length ?? 0,
      valid: true,
      file: path.relative(this.rootDir, targetPath).replace(/\\/g, "/"),
      content: this.normalizeContent(content),
      validation
    };
  }

  normalizeGeneratedYaml(content: string): string {
    const cleaned = content
      .replace(/^\s*```(?:yaml|yml)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    return this.normalizeContent(this.normalizeAiYamlShape(cleaned));
  }

  async saveCase(caseId: string, content: string) {
    const validation = this.validateContent(content);
    if (!validation.valid) {
      return { saved: false, validation };
    }
    const nextCaseId = this.normalizeCaseId(validation.caseId ?? "");
    if (!nextCaseId || !/^[a-z][a-z0-9_-]{2,63}$/.test(nextCaseId)) {
      return {
        saved: false,
        validation: {
          ...validation,
          valid: false,
          issues: [
            ...validation.issues,
            { path: "case_id", message: "case_id 只能使用小写字母、数字、下划线或中划线，且必须以小写字母开头，长度 3-64 位" }
          ]
        }
      };
    }

    const filePath = await this.findScenarioPath(caseId);
    const targetPath = path.resolve(this.scenarioDir(), `${nextCaseId}.yaml`);
    if (!targetPath.startsWith(this.scenarioDir() + path.sep)) {
      throw new Error("用例文件路径非法");
    }
    if (nextCaseId !== caseId) {
      const files = await this.listScenarioFiles();
      for (const existingPath of files) {
        if (existingPath === filePath) {
          continue;
        }
        const existing = validateScenarioContent(await fs.readFile(existingPath, "utf8"));
        if (this.caseIdFromFilePath(existingPath) === nextCaseId || existing.caseId === nextCaseId) {
          throw new Error(`case_id 已存在：${nextCaseId}`);
        }
      }
      await fs.rename(filePath, targetPath);
    }

    const finalPath = nextCaseId === caseId ? filePath : targetPath;
    await fs.writeFile(finalPath, this.normalizeContent(content), "utf8");
    return {
      saved: true,
      caseId: nextCaseId,
      file: path.relative(this.rootDir, finalPath).replace(/\\/g, "/"),
      validation
    };
  }

  async deleteCase(caseId: string) {
    const filePath = await this.findScenarioPath(caseId);
    const scenarioDir = this.scenarioDir();
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(scenarioDir + path.sep)) {
      throw new Error("用例文件路径非法");
    }

    const content = await fs.readFile(resolvedFilePath, "utf8");
    const validation = validateScenarioContent(content);
    const deletedCaseId = validation.caseId ?? this.caseIdFromFilePath(resolvedFilePath);
    const file = path.relative(this.rootDir, resolvedFilePath).replace(/\\/g, "/");

    await fs.unlink(resolvedFilePath);
    return {
      deleted: true,
      caseId: deletedCaseId,
      file
    };
  }

  validateContent(content: string): CaseValidationResult {
    try {
      const result = validateScenarioContent(content);
      return {
        valid: result.valid,
        caseId: result.caseId,
        caseName: result.caseName,
        issues: result.issues
      };
    } catch (error) {
      return {
        valid: false,
        issues: [{ path: "yaml", message: error instanceof Error ? error.message : String(error) }]
      };
    }
  }

  private async findScenarioPath(caseId: string): Promise<string> {
    const files = await this.listScenarioFiles();
    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = validateScenarioContent(content);
      const candidateCaseId = parsed.caseId ?? this.caseIdFromFilePath(filePath);
      if (candidateCaseId === caseId) {
        return filePath;
      }
    }
    throw new Error(`未找到用例：${caseId}`);
  }

  private scenarioDir(): string {
    return path.resolve(this.rootDir, "cases", "scenario");
  }

  private async listScenarioFiles(): Promise<string[]> {
    const scenarioDir = this.scenarioDir();
    const files = await fs.readdir(scenarioDir);
    return files
      .filter((item) => item.endsWith(".yaml") || item.endsWith(".yml"))
      .map((item) => path.resolve(scenarioDir, item))
      .filter((filePath) => filePath.startsWith(scenarioDir + path.sep));
  }

  private caseIdFromFilePath(filePath: string): string {
    return path.basename(filePath).replace(/\.(ya?ml)$/i, "");
  }

  private normalizeContent(content: string): string {
    return content.endsWith("\n") ? content : `${content}\n`;
  }

  private normalizeAiYamlShape(content: string): string {
    try {
      const raw = YAML.parse(content) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return content;
      }

      const scenario = raw as Record<string, unknown>;
      const sessions = this.normalizeAiSessions(scenario.sessions);
      let steps = this.normalizeAiSteps(scenario.steps, sessions);
      let variables = this.normalizeAiVariables(scenario.variables, steps);
      steps = this.normalizeAiStepSafety(this.ensureLoginOpenSteps(steps), variables);
      variables = this.normalizeAiVariables(variables, steps);

      scenario.sessions = sessions;
      scenario.steps = steps;
      scenario.defaults = this.normalizeAiDefaults(scenario.defaults);
      if (Object.keys(variables).length) {
        scenario.variables = variables;
      } else {
        delete scenario.variables;
      }
      scenario.mode = this.normalizeAiMode(scenario.mode, sessions);
      scenario.locations = this.normalizeAiLocations(scenario.locations, sessions);

      return YAML.stringify(scenario).trim();
    } catch {
      return content;
    }
  }

  private normalizeAiSessions(value: unknown): Array<Record<string, unknown>> {
    const sessions = Array.isArray(value) ? value.filter(this.isRecord) : [];
    const normalized = sessions.map((session) => {
      const name = this.sessionName(session.name);
      const loginUrl = this.stringValue(session.login_url)
        || this.stringValue(session.loginUrl)
        || this.stringValue(session.url)
        || this.defaultLoginUrl(name);

      return {
        ...session,
        name,
        login_url: loginUrl,
        username: this.stringValue(session.username) || this.defaultUsername(name),
        password: this.stringValue(session.password) || this.defaultPassword(name)
      };
    });

    return normalized.length ? normalized : [
      {
        name: "user",
        login_url: "${env.USER_LOGIN_URL}",
        username: "${env.USER_USERNAME}",
        password: "${env.USER_PASSWORD}"
      }
    ];
  }

  private normalizeAiDefaults(value: unknown): { step_timeout_ms: number; wait_for_network: boolean } {
    const defaults = this.isRecord(value) ? value : {};
    const rawTimeout = Number(defaults.step_timeout_ms ?? defaults.timeout_ms ?? defaults.timeoutMs);
    return {
      step_timeout_ms: Number.isFinite(rawTimeout) && rawTimeout > 0 ? Math.floor(rawTimeout) : 60_000,
      wait_for_network: typeof defaults.wait_for_network === "boolean" ? defaults.wait_for_network : true
    };
  }

  private normalizeAiSteps(value: unknown, sessions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const steps = Array.isArray(value) ? value.filter(this.isRecord) : [];
    return steps.map((step, index) => {
      const normalized = { ...step };
      const session = this.sessionName(normalized.session);
      const stepId = this.stringValue(normalized.step_id)
        || this.stringValue(normalized.stepId)
        || this.stringValue(normalized.id)
        || this.stringValue(normalized.key)
        || this.defaultStepId(session, normalized.type, index);
      const name = this.stringValue(normalized.name)
        || this.stringValue(normalized.title)
        || this.stringValue(normalized.label)
        || this.stringValue(normalized.description)
        || stepId;

      normalized.step_id = this.normalizeStepId(stepId, index);
      normalized.name = name;
      normalized.type = this.normalizeStepType(normalized.type, normalized.action, normalized.name);
      normalized.session = session;
      normalized.target = this.stringValue(normalized.target)
        || this.stringValue(normalized.locator)
        || this.stringValue(normalized.selector)
        || this.stringValue(normalized.element)
        || undefined;
      normalized.file = this.stringValue(normalized.file)
        || this.stringValue(normalized.file_path)
        || this.stringValue(normalized.filePath)
        || undefined;
      const expectedText = this.stringValue(normalized.expected)
        || this.stringValue(normalized.text)
        || this.stringValue(normalized.assertion)
        || undefined;
      normalized.expected = expectedText || (this.isRecord(normalized.expected) ? normalized.expected : undefined);
      normalized.url = this.normalizeAiUrl(this.stringValue(normalized.url) || this.stringValue(normalized.href) || this.stringValue(normalized.path));
      normalized.value = this.stringValue(normalized.value) || undefined;

      if (normalized.type === "flow_login") {
        normalized.username = this.stringValue(normalized.username) || "${session.username}";
        normalized.password = this.stringValue(normalized.password) || "${session.password}";
      }

      return normalized;
    });
  }

  private normalizeAiVariables(value: unknown, steps: Array<Record<string, unknown>>): Record<string, string> {
    const variables: Record<string, string> = {};
    if (this.isRecord(value)) {
      for (const [key, rawValue] of Object.entries(value)) {
        const variableName = this.normalizeVariableName(key);
        const variableValue = this.stringValue(rawValue);
        if (variableName && variableValue) {
          variables[variableName] = variableValue;
        }
      }
    }

    for (const variableName of this.collectVariableRefs(steps)) {
      if (variables[variableName] || this.isFileLikeVariable(variableName)) {
        continue;
      }
      variables[variableName] = this.defaultVariableValue(variableName);
    }

    return variables;
  }

  private normalizeAiStepSafety(steps: Array<Record<string, unknown>>, variables: Record<string, string>): Array<Record<string, unknown>> {
    return steps
      .filter((step) => {
        if (step.type !== "web_upload") {
          return true;
        }
        const file = this.stringValue(step.file);
        if (!file) {
          return false;
        }
        const missingFileVariable = [...file.matchAll(/\$\{var\.([^}]+)\}/g)]
          .some((match) => !variables[this.normalizeVariableName(match[1] ?? "")]);
        return !missingFileVariable;
      })
      .map((step) => {
        const normalized = { ...step };
        if (normalized.type === "web_assert_text" && !this.stringValue(normalized.target) && this.stringValue(normalized.expected)) {
          normalized.target = this.stringValue(normalized.expected);
        }
        return normalized;
      });
  }

  private ensureLoginOpenSteps(steps: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const normalized: Array<Record<string, unknown>> = [];
    const openedSessions = new Set<string>();

    for (const step of steps) {
      const session = this.sessionName(step.session);
      const isOpenStep = step.type === "web_open";
      if (isOpenStep) {
        openedSessions.add(session);
      }

      if (step.type === "flow_login" && !openedSessions.has(session)) {
        normalized.push({
          step_id: this.uniqueStepId(`${session}_open_login`, [...normalized, ...steps]),
          name: `${session} 打开登录页`,
          type: "web_open",
          session,
          url: "${session.login_url}"
        });
        openedSessions.add(session);
      }

      normalized.push(step);
    }

    return normalized;
  }

  private uniqueStepId(base: string, steps: Array<Record<string, unknown>>): string {
    const existing = new Set(steps.map((step) => this.stringValue(step.step_id)).filter(Boolean));
    if (!existing.has(base)) {
      return base;
    }
    for (let index = 2; index < 100; index += 1) {
      const candidate = `${base}_${index}`;
      if (!existing.has(candidate)) {
        return candidate;
      }
    }
    return `${base}_${Date.now()}`;
  }

  private normalizeAiUrl(value: string): string | undefined {
    if (!value) {
      return undefined;
    }
    return value
      .replace(/\$\{env\.ADMIN_LOGIN_URL\}\/?#\//g, "${session.login_url}#/")
      .replace(/\$\{env\.USER_LOGIN_URL\}\/?#\//g, "${session.login_url}#/")
      .replace(/\$\{session\.login_url\}\/+#\//g, "${session.login_url}#/");
  }

  private normalizeAiMode(value: unknown, sessions: Array<Record<string, unknown>>): "web" | "hybrid" {
    if (value === "web" || value === "hybrid") {
      return value;
    }
    return sessions.some((session) => session.name === "admin") && sessions.some((session) => session.name === "user")
      ? "hybrid"
      : "web";
  }

  private normalizeAiLocations(value: unknown, sessions: Array<Record<string, unknown>>): { file: string } {
    if (this.isRecord(value)) {
      const file = this.stringValue(value.file) || this.defaultLocationFile(sessions);
      return { ...value, file };
    }
    return { file: this.defaultLocationFile(sessions) };
  }

  private normalizeStepType(type: unknown, action: unknown, name: unknown): string {
    const value = [this.stringValue(type), this.stringValue(action), this.stringValue(name)].filter(Boolean).join(" ").toLowerCase();
    const supported = new Set([
      "web_open", "web_reload", "web_input", "web_click", "web_upload", "web_wait_text", "web_wait_element",
      "web_assert_text", "web_assert_visible", "web_assert_url", "web_extract", "web_screenshot", "flow_login",
      "flow_submit_kyc", "flow_admin_approve_kyc", "api_request", "api_assert", "db_query", "db_assert", "db_clean"
    ]);

    const rawType = this.stringValue(type);
    if (rawType && supported.has(rawType)) {
      return rawType;
    }
    if (value.includes("login") || value.includes("登录")) return "flow_login";
    if (value.includes("open") || value.includes("navigate") || value.includes("打开") || value.includes("进入")) return "web_open";
    if (value.includes("upload") || value.includes("上传")) return "web_upload";
    if (value.includes("input") || value.includes("fill") || value.includes("输入")) return "web_input";
    if (value.includes("assert") || value.includes("visible") || value.includes("断言") || value.includes("可见")) return "web_assert_visible";
    if (value.includes("wait") || value.includes("等待")) return "web_wait_element";
    return "web_click";
  }

  private defaultLocationFile(sessions: Array<Record<string, unknown>>): string {
    const names = new Set(sessions.map((session) => session.name));
    if (names.has("admin") && !names.has("user")) return "cases/location/login.admin.yaml";
    if (names.has("admin") && names.has("user")) return "cases/location/kyc.submit-and-approve.yaml";
    return "cases/location/login.user.yaml";
  }

  private defaultLoginUrl(name: "user" | "admin"): string {
    return name === "admin" ? "${env.ADMIN_LOGIN_URL}" : "${env.USER_LOGIN_URL}";
  }

  private defaultUsername(name: "user" | "admin"): string {
    return name === "admin" ? "${env.ADMIN_USERNAME}" : "${env.USER_USERNAME}";
  }

  private defaultPassword(name: "user" | "admin"): string {
    return name === "admin" ? "${env.ADMIN_PASSWORD}" : "${env.USER_PASSWORD}";
  }

  private collectVariableRefs(value: unknown): string[] {
    if (typeof value === "string") {
      return [...value.matchAll(/\$\{var\.([^}]+)\}/g)]
        .map((match) => this.normalizeVariableName(match[1] ?? ""))
        .filter(Boolean);
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectVariableRefs(item));
    }
    if (this.isRecord(value)) {
      return Object.values(value).flatMap((item) => this.collectVariableRefs(item));
    }
    return [];
  }

  private normalizeVariableName(value: string): string {
    return value.trim().replace(/\s+/g, "_");
  }

  private isFileLikeVariable(value: string): boolean {
    return /file|path|avatar|image|upload/i.test(value);
  }

  private defaultVariableValue(value: string): string {
    if (/user|name|title/i.test(value)) {
      return `auto_${"${timestamp}"}`;
    }
    return "${timestamp}";
  }

  private defaultStepId(session: "user" | "admin", type: unknown, index: number): string {
    return `${session}_${this.normalizeCaseId(this.stringValue(type) || "step")}_${index + 1}`;
  }

  private normalizeStepId(value: string, index: number): string {
    const normalized = this.normalizeCaseId(value).replace(/^-+|-+$/g, "");
    return /^[a-z][a-z0-9_-]*$/.test(normalized) ? normalized : `step_${index + 1}`;
  }

  private sessionName(value: unknown): "user" | "admin" {
    return this.stringValue(value).toLowerCase() === "admin" ? "admin" : "user";
  }

  private stringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private normalizeCaseId(caseId: string): string {
    return caseId.trim().replace(/\s+/g, "_").toLowerCase();
  }

  private buildCaseYaml(input: Required<Omit<CreateCaseInput, "description">> & { description?: string }): string {
    const description = input.description || this.defaultDescription(input.template);
    const body = this.templateBody(input.template);

    return [
      `case_id: ${input.caseId}`,
      `case_name: ${this.quoteYaml(input.caseName)}`,
      `description: ${this.quoteYaml(description)}`,
      `mode: ${body.mode}`,
      "sessions:",
      ...body.sessions,
      "locations:",
      `  file: "${body.locationFile}"`,
      "steps:",
      ...body.steps,
      ""
    ].join("\n");
  }

  private templateBody(template: CaseTemplate): { mode: "web" | "hybrid"; locationFile: string; sessions: string[]; steps: string[] } {
    if (template === "admin_login") {
      return {
        mode: "web",
        locationFile: "cases/location/login.admin.yaml",
        sessions: [
          "  - name: admin",
          "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
          "    username: \"${env.ADMIN_USERNAME}\"",
          "    password: \"${env.ADMIN_PASSWORD}\""
        ],
        steps: [
          "  - step_id: admin_open_login",
          "    name: admin 打开登录页",
          "    type: web_open",
          "    session: admin",
          "    url: \"${session.login_url}\"",
          "  - step_id: admin_login",
          "    name: admin 登录",
          "    type: flow_login",
          "    session: admin",
          "    username: \"${session.username}\"",
          "    password: \"${session.password}\"",
          "  - step_id: admin_assert_home_visible",
          "    name: admin 登录后页面可见",
          "    type: web_assert_visible",
          "    session: admin",
          "    target: admin_home_marker",
          "    continue_on_failure: true"
        ]
      };
    }

    if (template === "user_admin_kyc") {
      return {
        mode: "hybrid",
        locationFile: "cases/location/kyc.submit-and-approve.yaml",
        sessions: [
          "  - name: user",
          "    login_url: \"${env.USER_LOGIN_URL}\"",
          "    username: \"${env.USER_USERNAME}\"",
          "    password: \"${env.USER_PASSWORD}\"",
          "  - name: admin",
          "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
          "    username: \"${env.ADMIN_USERNAME}\"",
          "    password: \"${env.ADMIN_PASSWORD}\""
        ],
        steps: [
          "  - step_id: user_open_login",
          "    name: user 打开登录页",
          "    type: web_open",
          "    session: user",
          "    url: \"${session.login_url}\"",
          "  - step_id: user_login",
          "    name: user 登录",
          "    type: flow_login",
          "    session: user",
          "    username: \"${session.username}\"",
          "    password: \"${session.password}\"",
          "  - step_id: user_submit_kyc",
          "    name: user 提交 KYC",
          "    type: flow_submit_kyc",
          "    session: user",
          "  - step_id: admin_open_login",
          "    name: admin 打开登录页",
          "    type: web_open",
          "    session: admin",
          "    url: \"${session.login_url}\"",
          "  - step_id: admin_login",
          "    name: admin 登录",
          "    type: flow_login",
          "    session: admin",
          "    username: \"${session.username}\"",
          "    password: \"${session.password}\"",
          "  - step_id: admin_approve_kyc",
          "    name: admin 审核通过 KYC",
          "    type: flow_admin_approve_kyc",
          "    session: admin"
        ]
      };
    }

    return {
      mode: "web",
      locationFile: "cases/location/login.user.yaml",
      sessions: [
        "  - name: user",
        "    login_url: \"${env.USER_LOGIN_URL}\"",
        "    username: \"${env.USER_USERNAME}\"",
        "    password: \"${env.USER_PASSWORD}\""
      ],
      steps: [
        "  - step_id: user_open_login",
        "    name: user 打开登录页",
        "    type: web_open",
        "    session: user",
        "    url: \"${session.login_url}\"",
        "  - step_id: user_login",
        "    name: user 登录",
        "    type: flow_login",
        "    session: user",
        "    username: \"${session.username}\"",
        "    password: \"${session.password}\"",
        "  - step_id: user_assert_home_visible",
        "    name: user 登录后页面可见",
        "    type: web_assert_visible",
        "    session: user",
        "    target: user_home_marker",
        "    continue_on_failure: true"
      ]
    };
  }

  private defaultDescription(template: CaseTemplate): string {
    const descriptions: Record<CaseTemplate, string> = {
      user_login: "user 登录流程，用于验证用户端登录入口、账号密码提交和登录后页面可见性。",
      admin_login: "admin 登录流程，用于验证管理端登录入口、账号密码提交和登录后页面可见性。",
      user_admin_kyc: "user 提交 KYC 后由 admin 审核的端到端流程骨架。"
    };
    return descriptions[template];
  }

  private quoteYaml(value: string): string {
    return JSON.stringify(value);
  }
}

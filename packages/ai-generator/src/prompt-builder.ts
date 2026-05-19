import { appProductName } from "./brand";

export function buildCaseGenerationPrompt(requirement: string): string {
  return [
    "你是 AI 自动化测试平台的 DSL 生成器。",
    "只能输出标准 YAML DSL 草稿，不要直接操作浏览器，不要生成 Playwright spec。",
    "生成内容必须包含 case_id、case_name、mode、sessions、locations.file 和 steps。",
    "账号、密码、token 必须引用环境变量，不允许写死。",
    "用户需求如下：",
    requirement
  ].join("\n");
}

export interface MaterialCaseGenerationPromptInput {
  caseId: string;
  caseName: string;
  description?: string;
  templateHint?: string;
  requirement?: string;
  materials: Array<{ title: string; content: string }>;
}

export function buildMaterialCaseGenerationPrompt(input: MaterialCaseGenerationPromptInput): string {
  const materials = input.materials.length
    ? input.materials.map((item, index) => [
      `## 资料 ${index + 1}：${item.title}`,
      item.content
    ].join("\n")).join("\n\n")
    : "无补充资料";

  return [
    `你是 ${appProductName()} 的自动化测试 DSL 生成器。`,
    "请根据用户提供的 PRD、开源文档链接内容、docx/PDF 文档摘录和补充需求，生成一份 scenario YAML。",
    "只输出最终 YAML 正文，不要输出 Markdown 代码围栏、解释、注释或 diff。",
    "YAML 必须能被平台 DSL 校验：包含 case_id、case_name、mode、sessions、locations.file、steps。",
    "建议在顶层输出 defaults: { step_timeout_ms: 60000, wait_for_network: true }，除非用户明确要求更短超时。",
    "mode 只能是 web 或 hybrid，禁止输出 sequential、parallel、e2e 等其他值。",
    "sessions 每一项必须包含 name 和 login_url；字段名必须是 login_url，不要写成 url、loginUrl 或 baseUrl。",
    "sessions 每一项必须包含 username 和 password，并引用 ${env.USER_USERNAME}/${env.USER_PASSWORD} 或 ${env.ADMIN_USERNAME}/${env.ADMIN_PASSWORD}。",
    "steps 每一项必须包含 step_id、name、type；字段名必须是 step_id 和 name，不要写成 id、key、title、label 或 action。",
    "flow_login 步骤必须显式包含 username: \"${session.username}\" 和 password: \"${session.password}\"。",
    "每个 session 的第一个 flow_login 前必须先有 web_open 步骤打开 ${session.login_url}，不要直接以 flow_login 作为第一步。",
    "涉及页面跳转、菜单点击、保存提交、列表加载等接口异步渲染场景时，在对应步骤设置 wait_for_network: true，或在后续插入 web_wait_element / web_wait_text 等待目标元素出现。",
    "涉及“提交/保存/审核后核对数据是否真的落库”的需求时，优先在 UI 操作后追加 db_assert；只允许 select/show/desc/describe/explain 只读 SQL，不要生成 db_clean 或任何 insert/update/delete/drop/truncate。",
    "db_query/db_assert 字段规范：sql 写参数化只读 SQL，params 写数组参数，expected 可写字符串或字段对象，save_as 可把 db_query 的单列值或整行 JSON 写入 ${var.xxx}，row_index 从 0 开始。",
    "定位字段必须使用 target；上传文件字段必须使用 file；文本断言字段必须使用 expected。不要输出 locator、selector、file_path 或 text 字段。",
    "target 优先使用 locations.file 中已有定位 key；没有 key 时可使用页面可见文案；确需选择器时可直接写 XPath（如 //span[text()='系统']）或 CSS（如 .el-menu-item），不要把选择器写到 selector/locator 字段。",
    "step.type 只能使用：web_open、web_reload、web_input、web_click、web_upload、web_wait_text、web_wait_element、web_assert_text、web_assert_visible、web_assert_url、web_extract、web_screenshot、flow_login、flow_submit_kyc、flow_admin_approve_kyc、api_request、api_assert、db_query、db_assert、db_clean。",
    "session 只能使用 user 或 admin。",
    "账号、密码、token、cookie、真实密钥、真实生产 URL 禁止写死，必须引用 ${env.xxx}、${session.xxx} 或 ${var.xxx}。",
    "如果使用 ${var.xxx}，必须在 YAML 顶层 variables 中定义对应变量。",
    "没有明确上传文件路径或测试素材时，不要生成 web_upload 步骤。",
    "URL 优先使用 ${session.login_url}；admin hash 路由页面使用形如 ${session.login_url}#/admin/sys/perinfo，避免拼出双斜杠。",
    "若资料缺少页面定位细节，优先生成可编辑的流程骨架，并使用已有 locations.file：user 登录用 cases/location/login.user.yaml，admin 登录用 cases/location/login.admin.yaml，KYC 流程用 cases/location/kyc.submit-and-approve.yaml。",
    "最小结构示例：",
    "case_id: example_case",
    "case_name: 示例用例",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "    username: \"${env.ADMIN_USERNAME}\"",
    "    password: \"${env.ADMIN_PASSWORD}\"",
    "locations:",
    "  file: \"cases/location/login.admin.yaml\"",
    "steps:",
    "  - step_id: admin_open_login",
    "    name: admin 打开登录页",
    "    type: web_open",
    "    session: admin",
    "    url: \"${session.login_url}\"",
    `目标 case_id：${input.caseId}`,
    `目标 case_name：${input.caseName}`,
    `说明：${input.description || "无"}`,
    `模板倾向：${input.templateHint || "由资料判断"}`,
    `用户补充要求：${input.requirement || "无"}`,
    "资料内容：",
    materials
  ].join("\n");
}

export function buildLocationGenerationPrompt(pageDescription: string): string {
  return [
    "请根据页面说明生成 location YAML。",
    "定位优先级：data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath。",
    "xpath 只能作为最后兜底。",
    "页面说明如下：",
    pageDescription
  ].join("\n");
}

export type CaseYamlAssistMode = "write" | "continue" | "optimize" | "fix";

export interface CaseYamlAssistPromptInput {
  mode: CaseYamlAssistMode;
  caseId?: string;
  currentYaml: string;
  instruction?: string;
  validationIssues?: Array<{ path: string; message: string }>;
}

export function buildCaseYamlAssistPrompt(input: CaseYamlAssistPromptInput): string {
  const modeInstruction: Record<CaseYamlAssistMode, string> = {
    write: "根据用户意图重新生成一份完整 scenario YAML，可参考当前 YAML 的 case_id、sessions、locations 和变量。",
    continue: "在现有 YAML 基础上续写或补充 steps，尽量保留已有内容、命名风格和 case_id。",
    optimize: "优化现有 YAML 的步骤命名、顺序、等待与断言表达，保持业务语义不变。",
    fix: "根据校验问题修复 YAML，优先保证能通过平台 DSL 校验。"
  };

  const issues = input.validationIssues?.length
    ? input.validationIssues.map((item) => `- ${item.path}: ${item.message}`).join("\n")
    : "无";

  return [
    `你是 ${appProductName()} 的 scenario YAML 助手。`,
    "只输出最终 YAML，不要输出 Markdown 代码围栏、解释、注释或 diff。",
    "YAML 必须能被平台 DSL 校验：包含 case_id、case_name、mode、sessions、locations.file、steps。",
    "step.type 只能使用：web_open、web_reload、web_input、web_click、web_upload、web_wait_text、web_wait_element、web_assert_text、web_assert_visible、web_assert_url、web_extract、web_screenshot、flow_login、flow_submit_kyc、flow_admin_approve_kyc、api_request、api_assert、db_query、db_assert、db_clean。",
    "session 只能使用 user 或 admin；账号、密码、token、URL 等敏感值必须引用 ${env.xxx}、${session.xxx} 或 ${变量}，禁止写死真实值。",
    "target 应优先复用 locations.file 中已有定位 key；没有 key 时可用页面文案，必要时可直接使用 XPath/CSS；不要臆造生产密钥或真实账号。",
    "如果用户要求操作后核对数据库，使用 db_assert 追加只读 SQL 断言；sql 必须参数化，params 使用数组，expected 可为字符串或字段对象；不要生成 db_clean 或写入型 SQL。",
    input.caseId ? `当前编辑的 case_id 是 ${input.caseId}，除非用户明确要求重建新用例，否则 case_id 必须保持不变。` : "",
    `当前模式：${input.mode}。${modeInstruction[input.mode]}`,
    `用户意图：${input.instruction?.trim() || "无补充要求"}`,
    `当前校验问题：\n${issues}`,
    "当前 YAML：",
    "```yaml",
    input.currentYaml,
    "```"
  ].filter(Boolean).join("\n");
}

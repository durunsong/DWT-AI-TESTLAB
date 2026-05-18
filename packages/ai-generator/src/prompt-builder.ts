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

export function buildLocationGenerationPrompt(pageDescription: string): string {
  return [
    "请根据页面说明生成 location YAML。",
    "定位优先级：data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath。",
    "xpath 只能作为最后兜底。",
    "页面说明如下：",
    pageDescription
  ].join("\n");
}

import type { DeveloperFailureCategory, DeveloperHandoffSummary, DeveloperOwnerHint, StepResult } from "@ai-e2e/shared";
import type { ArtifactPaths } from "../utils/artifact";

export function buildDeveloperHandoffSummary(input: {
  runId: string;
  caseId: string;
  env: string;
  failedStep?: StepResult;
  artifacts: Partial<ArtifactPaths>;
}): DeveloperHandoffSummary | undefined {
  const failedStep = input.failedStep;
  if (!failedStep) {
    return undefined;
  }

  const category = classifyFailure(failedStep);
  const ownerHint = ownerByCategory(category);
  const evidence = buildEvidence(failedStep);

  return {
    title: buildTitle(ownerHint, category, failedStep),
    severity: "major",
    ownerHint,
    category,
    failedStepId: failedStep.stepId,
    failedStepName: failedStep.name,
    failedStepType: failedStep.type,
    evidence,
    reproduce: [
      `在 ${input.env} 环境执行用例 ${input.caseId}`,
      `打开运行记录 ${input.runId}`,
      `查看失败步骤 ${failedStep.stepId} 以及关联截图、日志和 trace`
    ],
    suggestedAction: suggestedAction(category),
    relatedArtifacts: {
      screenshot: failedStep.screenshot,
      trace: failedStep.trace,
      log: input.artifacts.logFile,
      jsonReport: input.artifacts.jsonReport,
      htmlReport: input.artifacts.htmlReport
    }
  };
}

function classifyFailure(step: StepResult): DeveloperFailureCategory {
  const text = `${step.type} ${step.error ?? ""} ${JSON.stringify(step.data ?? {})}`.toLowerCase();
  if (/business|接口|响应|http|api|status|code|success=false|failurecode|bodyjson|waitforapi/.test(text)) {
    return "api_business_failure";
  }
  if (/未找到|定位|locator|selector|visible|可见元素|element|strict mode|timeout/.test(text)) {
    return "locator_or_ui_change";
  }
  if (/env|环境变量|账号|密码|登录|token|数据|缺少|不存在/.test(text)) {
    return "environment_or_data";
  }
  if (/断言|assert|expected|期望/.test(text)) {
    return "assertion_failure";
  }
  if (/browser|context|trace|playwright|运行器|runtime/.test(text)) {
    return "automation_runtime";
  }
  return "unknown";
}

function ownerByCategory(category: DeveloperFailureCategory): DeveloperOwnerHint {
  const owners: Record<DeveloperFailureCategory, DeveloperOwnerHint> = {
    api_business_failure: "backend",
    locator_or_ui_change: "frontend",
    assertion_failure: "test",
    environment_or_data: "environment",
    automation_runtime: "test",
    unknown: "unknown"
  };
  return owners[category];
}

function buildTitle(ownerHint: DeveloperOwnerHint, category: DeveloperFailureCategory, step: StepResult): string {
  const ownerText: Record<DeveloperOwnerHint, string> = {
    frontend: "前端页面或定位疑似变更",
    backend: "后端接口或业务返回异常",
    test: "自动化用例或断言需要确认",
    environment: "环境、账号或测试数据需要确认",
    unknown: "失败原因需要进一步确认"
  };
  return `${ownerText[ownerHint]}：${step.stepId}（${category}）`;
}

function buildEvidence(step: StepResult): string[] {
  const evidence = [
    `失败步骤：${step.stepId} / ${step.name} / ${step.type}`,
    step.error ? `错误信息：${step.error}` : "",
    step.url ? `页面地址：${step.url}` : "",
    step.data !== undefined ? `诊断数据：${compactJson(step.data)}` : "",
    step.screenshot ? `失败截图：${step.screenshot}` : "",
    step.trace ? `Trace：${step.trace}` : ""
  ].filter(Boolean);
  return evidence.slice(0, 6);
}

function suggestedAction(category: DeveloperFailureCategory): string {
  const actions: Record<DeveloperFailureCategory, string> = {
    api_business_failure: "请后端开发优先检查接口返回码、业务错误信息和入参处理；同时确认前端是否按接口契约提交了必要字段。",
    locator_or_ui_change: "请前端开发确认页面元素、文案、组件结构或可访问属性是否变更；测试同学同步更新 location/YAML 定位。",
    assertion_failure: "请测试同学确认断言是否符合当前业务规则；如规则已变化，更新 YAML 断言和预期数据。",
    environment_or_data: "请先确认环境变量、账号权限、测试数据和前置状态是否满足用例要求。",
    automation_runtime: "请测试同学检查浏览器、trace、等待策略和运行器异常，必要时补充重试或等待条件。",
    unknown: "请结合失败截图、日志、trace 和 AI 分析进一步确认归因，再转给对应开发处理。"
  };
  return actions[category];
}

function compactJson(value: unknown): string {
  const content = JSON.stringify(value);
  if (!content) {
    return "-";
  }
  return content.length > 420 ? `${content.slice(0, 420)}...` : content;
}

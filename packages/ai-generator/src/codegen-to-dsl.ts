import type { ScenarioStep } from "@ai-e2e/shared";

export function convertCodegenScriptToSteps(script: string): ScenarioStep[] {
  return script
    .split(/\r?\n/)
    .map((line, index) => convertLine(line.trim(), index))
    .filter((step): step is ScenarioStep => Boolean(step));
}

function convertLine(line: string, index: number): ScenarioStep | undefined {
  const stepId = `codegen_step_${index + 1}`;
  const quoted = [...line.matchAll(/['"`]([^'"`]+)['"`]/g)].map((match) => match[1]);
  if (line.includes(".goto(") && quoted[0]) {
    return { step_id: stepId, name: "打开页面", type: "web_open", session: "user", url: quoted[0] };
  }
  if (line.includes(".fill(")) {
    return { step_id: stepId, name: "输入内容", type: "web_input", session: "user", target: `locator_${index + 1}`, value: lastValue(quoted) };
  }
  if (line.includes(".click(")) {
    return { step_id: stepId, name: "点击元素", type: "web_click", session: "user", target: `locator_${index + 1}` };
  }
  if (line.includes("toContainText")) {
    return { step_id: stepId, name: "断言文本", type: "web_assert_text", session: "user", target: `locator_${index + 1}`, expected: lastValue(quoted) };
  }
  if (line.includes("toBeVisible")) {
    return { step_id: stepId, name: "断言可见", type: "web_assert_visible", session: "user", target: `locator_${index + 1}` };
  }
  return undefined;
}

function lastValue(values: Array<string | undefined>): string {
  return values[values.length - 1] ?? "";
}

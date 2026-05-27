import type { ScenarioStep } from "@ai-e2e/shared";

export function convertPlaywrightLineToStep(line: string, index: number): ScenarioStep | undefined {
  const stepId = `codegen_step_${index + 1}`;
  if (line.includes(".goto(")) {
    const url = extractFirstString(line);
    return url ? { step_id: stepId, name: "打开页面", type: "web_open", session: "user", url } : undefined;
  }
  if (line.includes(".fill(")) {
    return { step_id: stepId, name: "输入内容", type: "web_input", session: "user", target: `locator_${index + 1}`, value: extractLastString(line) ?? "" };
  }
  if (line.includes(".click(")) {
    return { step_id: stepId, name: "点击元素", type: "web_click", session: "user", target: `locator_${index + 1}` };
  }
  if (line.includes("toContainText")) {
    return { step_id: stepId, name: "断言文本", type: "web_assert_text", session: "user", target: `locator_${index + 1}`, expected: extractLastString(line) ?? "" };
  }
  if (line.includes("toBeVisible")) {
    return { step_id: stepId, name: "断言可见", type: "web_assert_visible", session: "user", target: `locator_${index + 1}` };
  }
  return undefined;
}

function extractFirstString(line: string): string | undefined {
  return line.match(/['"`]([^'"`]+)['"`]/)?.[1];
}

function extractLastString(line: string): string | undefined {
  const matches = [...line.matchAll(/['"`]([^'"`]+)['"`]/g)];
  const lastMatch = matches[matches.length - 1];
  return lastMatch?.[1];
}

import type { ScenarioStep } from "@ai-e2e/shared";

export type ActionDiagnosticPhase = "after_input" | "before_click";

export interface InputValueDiagnostic {
  kind: "input_value";
  phase: ActionDiagnosticPhase;
  stepId?: string;
  stepName?: string;
  stepType?: string;
  target?: string;
  protected: boolean;
  matched: boolean;
  expectedValue?: string;
  actualValue?: string;
  expectedSummary?: ValueSummary;
  actualSummary?: ValueSummary;
  checkedAt: string;
}

export interface ValueSummary {
  empty: boolean;
  length: number;
}

export interface BuildInputValueDiagnosticInput {
  phase: ActionDiagnosticPhase;
  stepId?: string;
  stepName?: string;
  stepType?: string;
  target?: string;
  expectedValue: string;
  actualValue: string;
  checkedAt?: string;
}

export interface TrackedInput {
  step: ScenarioStep;
  expectedValue: string;
}

const protectedInputPattern = /(?:password|passwd|pwd|token|secret|cookie|authorization|username|account|email|mail|mobile|phone|手机号|邮箱|账号|账户|用户名|密码)/i;

export function buildInputValueDiagnostic(input: BuildInputValueDiagnosticInput): InputValueDiagnostic {
  const protectedValue = isProtectedInputTarget(input.target);
  const base = {
    kind: "input_value" as const,
    phase: input.phase,
    stepId: input.stepId,
    stepName: input.stepName,
    stepType: input.stepType,
    target: input.target,
    protected: protectedValue,
    matched: input.expectedValue === input.actualValue,
    checkedAt: input.checkedAt ?? new Date().toISOString()
  };

  if (protectedValue) {
    return {
      ...base,
      expectedSummary: summarizeValue(input.expectedValue),
      actualSummary: summarizeValue(input.actualValue)
    };
  }

  return {
    ...base,
    expectedValue: input.expectedValue,
    actualValue: input.actualValue
  };
}

export function isProtectedInputTarget(target: string | undefined): boolean {
  return protectedInputPattern.test(target ?? "");
}

function summarizeValue(value: string): ValueSummary {
  return {
    empty: value.length === 0,
    length: value.length
  };
}

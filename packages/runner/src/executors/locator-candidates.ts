import type { LocationDefinition, LocatorFallback } from "@ai-e2e/shared";

export type LocatorPlan =
  | { kind: "testId"; value: string }
  | { kind: "role"; value: string; name?: string }
  | { kind: "label"; value: string }
  | { kind: "placeholder"; value: string }
  | { kind: "text"; value: string }
  | { kind: "name"; value: string }
  | { kind: "css"; value: string }
  | { kind: "xpath"; value: string };

export function createLocatorPlans(definition: LocationDefinition): LocatorPlan[] {
  const plans: LocatorPlan[] = [];

  if (definition.testId) plans.push({ kind: "testId", value: definition.testId });
  if (definition.role) plans.push({ kind: "role", value: definition.role });
  if (definition.label) plans.push({ kind: "label", value: definition.label });
  if (definition.placeholder) plans.push({ kind: "placeholder", value: definition.placeholder });
  if (definition.text) plans.push({ kind: "text", value: definition.text });
  if (definition.name) plans.push({ kind: "name", value: definition.name });
  if (definition.css) plans.push({ kind: "css", value: definition.css });
  if (definition.xpath) plans.push({ kind: "xpath", value: definition.xpath });

  for (const fallback of definition.fallback ?? []) {
    plans.push(fallbackToPlan(fallback));
  }

  return plans;
}

function fallbackToPlan(fallback: LocatorFallback): LocatorPlan {
  if ("role" in fallback) return { kind: "role", value: fallback.role, name: fallback.name };
  if ("label" in fallback) return { kind: "label", value: fallback.label };
  if ("placeholder" in fallback) return { kind: "placeholder", value: fallback.placeholder };
  if ("text" in fallback) return { kind: "text", value: fallback.text };
  if ("name" in fallback) return { kind: "name", value: fallback.name };
  if ("css" in fallback) return { kind: "css", value: fallback.css };
  return { kind: "xpath", value: fallback.xpath };
}

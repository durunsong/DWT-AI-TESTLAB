import type { EnvVariable } from "../../types/settings";

export interface EnvVariableSearchRow extends EnvVariable {
  originalIndex: number;
}

export function filterEnvVariables(variables: EnvVariable[], query: string): EnvVariableSearchRow[] {
  const normalizedQuery = normalizeSearchText(query);
  return variables
    .map((variable, originalIndex) => ({ ...variable, originalIndex }))
    .filter((variable) => {
      if (!normalizedQuery) {
        return true;
      }
      return [variable.key, variable.value, variable.comment ?? ""]
        .map(normalizeSearchText)
        .some((text) => text.includes(normalizedQuery));
    });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

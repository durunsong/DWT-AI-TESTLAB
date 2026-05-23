import type { SharedAbility } from "../../types/case";

export interface SharedAbilityOption {
  label: string;
  value: string;
  title: string;
  description?: string;
  paramsText: string;
  tagsText: string;
  stepCount: number;
  file: string;
  searchText: string;
}

export function buildSharedAbilityOptions(abilities: SharedAbility[]): SharedAbilityOption[] {
  return abilities
    .slice()
    .sort((left, right) => left.sharedId.localeCompare(right.sharedId))
    .map((ability) => ({
      label: ability.name,
      value: ability.sharedId,
      title: `${ability.sharedId} / ${ability.stepCount} steps / ${ability.file}`,
      description: ability.description,
      paramsText: ability.params.map((param) => `${param.name}${param.required ? "*" : ""}`).join("、"),
      tagsText: ability.tags.join("、"),
      stepCount: ability.stepCount,
      file: ability.file,
      searchText: [
        ability.sharedId,
        ability.name,
        ability.description,
        ability.file,
        ability.tags.join(" "),
        ability.params.map((param) => [param.name, param.description, param.defaultValue].filter(Boolean).join(" ")).join(" ")
      ].filter(Boolean).join(" ")
    }));
}

export function summarizeSelectedSharedAbilities(abilities: SharedAbility[], selectedIds: string[] = []): SharedAbility[] {
  const selected = new Set(selectedIds);
  return abilities.filter((ability) => selected.has(ability.sharedId));
}

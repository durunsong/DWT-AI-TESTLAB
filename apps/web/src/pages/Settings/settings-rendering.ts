export const envVariablePageSize = 20;
export const routeContextLoadDelayMs = 160;

export function sensitiveValueFormName(originalIndex: number): string {
  return `env-sensitive-value-${originalIndex}`;
}

export function sensitiveUsernameFormName(originalIndex: number): string {
  return `env-sensitive-username-${originalIndex}`;
}

export const caseListRenderDelayMs = 80;

export function shouldRenderCreateCaseModal(createOpen: boolean, creating: boolean): boolean {
  return createOpen || creating;
}

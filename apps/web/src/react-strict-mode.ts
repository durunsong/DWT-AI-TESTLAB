export function shouldUseReactStrictMode(value: unknown): boolean {
  return value === true || value === "true";
}

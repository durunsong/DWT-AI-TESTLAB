export function toScreenshotUrl(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const index = normalized.toLowerCase().lastIndexOf("/screenshots/");
  if (index >= 0) {
    return normalized.slice(index);
  }
  if (normalized.toLowerCase().startsWith("screenshots/")) {
    return `/${normalized}`;
  }
  return normalized;
}

import { artifactUrl } from "../api/base-url";

export function toScreenshotUrl(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const index = normalized.toLowerCase().lastIndexOf("/screenshots/");
  if (index >= 0) {
    return artifactUrl(normalized.slice(index)) ?? normalized.slice(index);
  }
  if (normalized.toLowerCase().startsWith("screenshots/")) {
    return artifactUrl(`/${normalized}`) ?? `/${normalized}`;
  }
  return artifactUrl(normalized) ?? normalized;
}

export function toArtifactUrl(value: string | undefined): string | undefined {
  return artifactUrl(value);
}

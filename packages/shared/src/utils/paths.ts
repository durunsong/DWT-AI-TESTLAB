import path from "node:path";

export function resolveFromRoot(rootDir: string, ...segments: string[]): string {
  return path.resolve(rootDir, ...segments);
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

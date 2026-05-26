import { readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const pattern = process.argv[2] ?? "src/**/*.test.ts";
const rootDir = pattern.split("/**/")[0] || "src";
const suffix = pattern.endsWith(".test.ts") ? ".test.ts" : extname(pattern);
const testFiles = collectTestFiles(rootDir, suffix);

if (!testFiles.length) {
  console.log(`No test files matched ${pattern}; skipping.`);
  process.exit(0);
}

const result = spawnSync("tsx", ["--test", ...testFiles], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);

function collectTestFiles(dir, suffix) {
  try {
    return readdirRecursive(dir)
      .filter((file) => file.endsWith(suffix))
      .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
      .sort();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function readdirRecursive(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const file = join(dir, entry);
    const stats = statSync(file);
    if (stats.isDirectory()) {
      files.push(...readdirRecursive(file));
      continue;
    }
    files.push(file);
  }
  return files;
}

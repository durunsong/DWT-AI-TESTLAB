import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const styles = fs.readFileSync(path.resolve(currentDir, "../../styles/index.css"), "utf8");

test("report viewer constrains failed report content within the page", () => {
  assert.match(styles, /\.report-viewer\b/);
  assert.match(styles, /\.report-viewer \.ant-card\b[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.report-viewer__developer-summary\b[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.report-viewer__long-text\b[\s\S]*overflow-wrap:\s*anywhere/);
});

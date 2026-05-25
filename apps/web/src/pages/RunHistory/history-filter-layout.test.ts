import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "index.tsx");
const source = fs.readFileSync(sourcePath, "utf8");

test("history filters are rendered in the card title row with fixed control widths", () => {
  assert.match(source, /<Card\s+className="\[&_\.ant-card-head-title\]:!overflow-visible \[&_\.ant-card-head-title\]:!whitespace-normal"/);
  assert.match(source, /className="run-history__titlebar/);
  assert.match(source, /className="run-history__title-filters/);
  assert.match(source, /className="!w-\[300px\] !flex-none"/);
  assert.match(source, /className="!w-\[140px\] !flex-none"/);
  assert.doesNotMatch(source, /className="run-history__filters mb-4/);
});

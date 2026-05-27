import assert from "node:assert/strict";
import test from "node:test";
import { convertPlaywrightLineToStep } from "./codegen-converter";

test("uses the last quoted argument as the generated input value", () => {
  const step = convertPlaywrightLineToStep("await page.getByLabel('Username').fill('alice');", 0);

  assert.equal(step?.type, "web_input");
  assert.equal(step?.value, "alice");
});

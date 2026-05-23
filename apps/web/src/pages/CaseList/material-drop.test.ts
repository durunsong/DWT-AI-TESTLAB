import assert from "node:assert/strict";
import test from "node:test";
import { canAcceptCreateCaseMaterialDrop, createCaseMaterialDropCopy } from "./material-drop";

test("accepts page drop only for the AI create-case material tab", () => {
  assert.equal(canAcceptCreateCaseMaterialDrop({ createOpen: true, createMode: "ai", creating: false }), true);
  assert.equal(canAcceptCreateCaseMaterialDrop({ createOpen: false, createMode: "ai", creating: false }), false);
  assert.equal(canAcceptCreateCaseMaterialDrop({ createOpen: true, createMode: "template", creating: false }), false);
  assert.equal(canAcceptCreateCaseMaterialDrop({ createOpen: true, createMode: "ai", creating: true }), false);
});

test("uses copy that clearly points to create-case materials", () => {
  const copy = createCaseMaterialDropCopy();
  assert.match(copy.title, /新增用例资料/);
  assert.match(copy.description, /生成当前新增用例/);
});

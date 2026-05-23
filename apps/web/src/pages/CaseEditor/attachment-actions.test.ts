import assert from "node:assert/strict";
import test from "node:test";
import { primaryAttachmentViewAction } from "./attachment-actions";

test("uses preview as the primary file action for image attachments", () => {
  assert.equal(primaryAttachmentViewAction({ name: "avatar.png", file: "uploads/cases/demo/avatar.png" }), "preview");
});

test("uses download as the primary file action for non-image attachments", () => {
  assert.equal(primaryAttachmentViewAction({ name: "contract.pdf", file: "uploads/cases/demo/contract.pdf" }), "download");
});

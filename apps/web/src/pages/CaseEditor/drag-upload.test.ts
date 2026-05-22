import assert from "node:assert/strict";
import test from "node:test";
import { caseEditorDropCopy, hasFileDrag, resolveCaseEditorDropTarget } from "./drag-upload";

test("routes page drop to AI instruction files while AI drawer is open", () => {
  assert.equal(resolveCaseEditorDropTarget({
    aiOpen: true,
    attachmentUploading: false,
    aiInstructionUploading: false
  }), "aiInstruction");
});

test("routes page drop to case attachments when AI drawer is closed", () => {
  assert.equal(resolveCaseEditorDropTarget({
    aiOpen: false,
    attachmentUploading: false,
    aiInstructionUploading: false
  }), "caseAttachment");
});

test("does not accept page drop while the active target is uploading", () => {
  assert.equal(resolveCaseEditorDropTarget({
    aiOpen: true,
    attachmentUploading: false,
    aiInstructionUploading: true
  }), undefined);

  assert.equal(resolveCaseEditorDropTarget({
    aiOpen: false,
    attachmentUploading: true,
    aiInstructionUploading: false
  }), undefined);
});

test("detects only file drags", () => {
  assert.equal(hasFileDrag(["text/plain"]), false);
  assert.equal(hasFileDrag(["Files", "text/uri-list"]), true);
  assert.equal(hasFileDrag(undefined), false);
});

test("uses distinct drop copy for the two upload destinations", () => {
  assert.match(caseEditorDropCopy("aiInstruction").description, /不保存为测试附件/);
  assert.match(caseEditorDropCopy("caseAttachment").description, /web_upload/);
});

import { isImageAttachmentFile, type ImageAttachmentCheckInput } from "./attachment-prompt";

export type AttachmentPrimaryViewAction = "preview" | "download";

export function primaryAttachmentViewAction(input: ImageAttachmentCheckInput): AttachmentPrimaryViewAction {
  return isImageAttachmentFile(input) ? "preview" : "download";
}

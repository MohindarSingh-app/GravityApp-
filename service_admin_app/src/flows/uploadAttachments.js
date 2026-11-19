import { customerApi } from '../api/resources';

export async function uploadPendingAttachments(draft, patch) {
  const attachmentIds = [...(draft.attachmentIds || [])];
  const pending = [...(draft.pendingAttachments || [])];
  while (pending.length) {
    const [file, ...remaining] = pending;
    const upload = { ...file };
    delete upload.previewUri;
    delete upload.attachmentKind;
    const result = await customerApi.uploadAttachment(upload);
    attachmentIds.push(result.attachment.id);
    pending.splice(0, pending.length, ...remaining);
    patch({ attachmentIds: [...attachmentIds], pendingAttachments: [...pending] });
  }
  return attachmentIds;
}

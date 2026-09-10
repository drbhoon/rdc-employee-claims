export const MAX_CLAIM_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ATTACHMENTS_TOO_LARGE = "Your attachments exceed 10 MB. Please compress and resubmit.";

export function claimUploadError(data: FormData): string | null {
  let attachmentBytes = 0;
  let formBytes = 0;
  for (const [name, value] of data.entries()) {
    if (typeof value === "string") formBytes += new TextEncoder().encode(value).length;
    else attachmentBytes += value.size;
    // Reserve space for multipart boundaries, field names and file headers.
    formBytes += new TextEncoder().encode(name).length + 1024;
  }
  if (attachmentBytes > MAX_CLAIM_UPLOAD_BYTES) return ATTACHMENTS_TOO_LARGE;
  if (attachmentBytes + formBytes + 1024 >= MAX_CLAIM_UPLOAD_BYTES) {
    return "Your attachments are too close to the 10 MB limit to include the claim details. Please compress and resubmit.";
  }
  return null;
}

import assert from "node:assert/strict";
import { indiaDateInput } from "../lib/dateFormat";
import { claimUploadError, ATTACHMENTS_TOO_LARGE } from "../lib/claimUpload";
for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Kolkata"]) {
  process.env.TZ = timezone;
  assert.equal(indiaDateInput(new Date("2026-09-09T00:00:00+05:30")), "2026-09-09");
  assert.equal(indiaDateInput(new Date("2026-09-09T18:29:59Z")), "2026-09-09");
  assert.equal(indiaDateInput(new Date("2026-09-09T18:30:00Z")), "2026-09-10");
  assert.equal(indiaDateInput(new Date("2025-12-31T18:30:00Z")), "2026-01-01");
}
const data = new FormData();
for (let i = 0; i < 6; i++) data.append("attachment", new Blob([new Uint8Array(2 * 1024 * 1024)]), "receipt.jpg");
assert.equal(claimUploadError(data), ATTACHMENTS_TOO_LARGE);
data.delete("attachment");
for (let i = 0; i < 6; i++) data.append("attachment", new Blob([new Uint8Array(1024 * 1024)]), "receipt.jpg");
assert.equal(claimUploadError(data), null);
const edge = new FormData();
edge.append("attachment", new Blob([new Uint8Array(10 * 1024 * 1024)]), "receipt.jpg");
assert.match(claimUploadError(edge)!, /claim details/);
assert.equal(claimUploadError(new FormData()), null);
console.log("PASS: IST dates across timezones and combined attachment limits");

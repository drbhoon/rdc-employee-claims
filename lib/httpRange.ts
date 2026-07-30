type ByteRange = { start: number; end: number };

export function parseByteRange(rangeHeader: string | null, fileSize: number): ByteRange | null | "invalid" {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || fileSize <= 0) return "invalid";

  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return "invalid";

  let start: number;
  let end: number;
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : fileSize - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= fileSize) return "invalid";
    end = Math.min(end, fileSize - 1);
  }
  return { start, end };
}

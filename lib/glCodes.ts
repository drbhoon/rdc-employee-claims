export function normalizeGlCodes(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = [...new Set(values.flatMap((item) => item.split(",").map((code) => code.trim()).filter(Boolean)))];
  return normalized.includes("ALL") ? [] : normalized;
}

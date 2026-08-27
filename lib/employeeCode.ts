/**
 * Employee Codes are identifiers, never quantities. Keep the supplied text
 * exactly (apart from surrounding whitespace) so leading zeroes and letters
 * survive imports, database writes, reports, and payment matching.
 */
export function normalizeEmployeeCode(value: unknown) {
  return value == null ? "" : String(value).trim();
}

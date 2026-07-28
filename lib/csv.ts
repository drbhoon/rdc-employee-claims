export function toCsv(rows: Record<string, unknown>[], emptyHeaders: string[] = []) {
  const headers = rows.length ? Object.keys(rows[0]) : emptyHeaders;
  if (!headers.length) return "";
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

export function csvResponse(name: string, rows: Record<string, unknown>[], emptyHeaders: string[] = []) {
  return new Response(toCsv(rows, emptyHeaders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`
    }
  });
}

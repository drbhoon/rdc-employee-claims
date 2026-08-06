const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true
});

export function formatIndiaDateTime(value: Date | null | undefined) {
  return value ? indiaDateTimeFormatter.format(value) : "-";
}

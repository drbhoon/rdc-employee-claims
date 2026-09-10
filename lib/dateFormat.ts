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

const indiaDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
});

export function formatIndiaDate(value: Date) {
  return indiaDateFormatter.format(value);
}

export function indiaDateInput(value: Date = new Date()) {
  const parts = indiaDateFormatter.formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

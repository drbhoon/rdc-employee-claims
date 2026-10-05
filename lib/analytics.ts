export type AnalyticsClaimLine = {
  claimHeaderId: string;
  claimDate: Date;
  amount: unknown;
  gstAmount: unknown;
  glCode: string;
  glName: string;
  employeeId: string;
  employeeName: string;
  plant: string;
  location: string;
};

export type AnalyticsVolume = {
  periodMonth: Date;
  employeeId: string;
  employeeName: string;
  plant: string;
  location: string;
  volumeM3: unknown;
};

export type CostMetricRow = {
  key: string;
  label: string;
  amount: number;
  volumeM3: number;
  costPerM3: number | null;
};

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function indiaMonthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}`;
}

function volumeMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function cost(amount: number, volumeM3: number) {
  return volumeM3 > 0 ? amount / volumeM3 : null;
}

function metricRows(
  amounts: Map<string, { label: string; amount: number }>,
  volumes: Map<string, { label: string; volumeM3: number }>
) {
  const keys = new Set([...amounts.keys(), ...volumes.keys()]);
  return [...keys].map((key) => {
    const amount = amounts.get(key)?.amount || 0;
    const volumeM3 = volumes.get(key)?.volumeM3 || 0;
    return { key, label: volumes.get(key)?.label || amounts.get(key)?.label || key, amount, volumeM3, costPerM3: cost(amount, volumeM3) };
  });
}

function addAmount(map: Map<string, { label: string; amount: number }>, key: string, label: string, value: number) {
  const current = map.get(key) || { label, amount: 0 };
  current.amount += value;
  map.set(key, current);
}

function addVolume(map: Map<string, { label: string; volumeM3: number }>, key: string, label: string, value: number) {
  const current = map.get(key) || { label, volumeM3: 0 };
  current.volumeM3 += value;
  map.set(key, current);
}

export function calculateAnalytics(lines: AnalyticsClaimLine[], volumes: AnalyticsVolume[]) {
  const employeeAmounts = new Map<string, { label: string; amount: number }>();
  const employeeVolumes = new Map<string, { label: string; volumeM3: number }>();
  const plantAmounts = new Map<string, { label: string; amount: number }>();
  const plantVolumes = new Map<string, { label: string; volumeM3: number }>();
  const locationAmounts = new Map<string, { label: string; amount: number }>();
  const locationVolumes = new Map<string, { label: string; volumeM3: number }>();
  const monthAmounts = new Map<string, { label: string; amount: number }>();
  const monthVolumes = new Map<string, { label: string; volumeM3: number }>();
  const glAmounts = new Map<string, { label: string; amount: number }>();
  const claims = new Set<string>();
  let totalAmount = 0;
  let totalVolumeM3 = 0;

  for (const line of lines) {
    const lineAmount = number(line.amount) + number(line.gstAmount);
    const employeeKey = line.employeeId.toLowerCase();
    const plantKey = line.plant.toLowerCase();
    const locationKey = line.location.toLowerCase();
    const month = indiaMonthKey(line.claimDate);
    const glKey = line.glCode || "Unmapped";
    totalAmount += lineAmount;
    claims.add(line.claimHeaderId);
    addAmount(employeeAmounts, employeeKey, `${line.employeeId} - ${line.employeeName}`, lineAmount);
    addAmount(plantAmounts, plantKey, line.plant || "Unmapped", lineAmount);
    addAmount(locationAmounts, locationKey, line.location || "Unmapped", lineAmount);
    addAmount(monthAmounts, month, month, lineAmount);
    addAmount(glAmounts, glKey, `${glKey} - ${line.glName}`, lineAmount);
  }

  for (const row of volumes) {
    const value = number(row.volumeM3);
    const employeeKey = row.employeeId.toLowerCase();
    const plantKey = row.plant.toLowerCase();
    const locationKey = row.location.toLowerCase();
    const month = volumeMonthKey(row.periodMonth);
    totalVolumeM3 += value;
    addVolume(employeeVolumes, employeeKey, `${row.employeeId} - ${row.employeeName}`, value);
    addVolume(plantVolumes, plantKey, row.plant, value);
    addVolume(locationVolumes, locationKey, row.location, value);
    addVolume(monthVolumes, month, month, value);
  }

  const sortByCost = (rows: CostMetricRow[]) => rows.filter((row) => row.costPerM3 != null).sort((a, b) => (b.costPerM3 || 0) - (a.costPerM3 || 0));
  const employeeRows = sortByCost(metricRows(employeeAmounts, employeeVolumes));
  const plantRows = sortByCost(metricRows(plantAmounts, plantVolumes));
  const locationRows = sortByCost(metricRows(locationAmounts, locationVolumes));
  const monthlyRows = metricRows(monthAmounts, monthVolumes).sort((a, b) => a.key.localeCompare(b.key));
  const glRows = [...glAmounts.entries()].map(([key, value]) => ({ key, label: value.label, amount: value.amount, volumeM3: totalVolumeM3, costPerM3: cost(value.amount, totalVolumeM3) })).sort((a, b) => b.amount - a.amount);

  return {
    totalAmount,
    totalVolumeM3,
    costPerM3: cost(totalAmount, totalVolumeM3),
    claimCount: claims.size,
    employeeRows,
    plantRows,
    locationRows,
    monthlyRows,
    glRows,
    highestEmployee: employeeRows[0] || null,
    lowestEmployee: employeeRows.length ? employeeRows[employeeRows.length - 1] : null
  };
}

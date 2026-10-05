import { ClaimStatus, Prisma } from "@prisma/client";
import { Shell } from "@/components/Shell";
import { VolumeUploadPanel } from "@/components/VolumeUploadPanel";
import { calculateAnalytics } from "@/lib/analytics";
import { requireSuperAdmin } from "@/lib/auth";
import { formatIndiaDateTime, indiaDateInput } from "@/lib/dateFormat";
import { isWorkflowPlaceholderEmployeeId } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";
import { periodMonthDate } from "@/lib/volumeUpload";

const approvedStatuses: ClaimStatus[] = ["FINAL_APPROVED", "PAYMENT_DOWNLOADED", "PAID"];

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function list(value: SearchValue) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function validMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function nextMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

function claimPeriod(from: string, to: string) {
  return {
    gte: new Date(`${from}-01T00:00:00.000+05:30`),
    lt: new Date(`${nextMonth(to)}-01T00:00:00.000+05:30`)
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function quantity(value: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function rate(value: number | null) {
  return value == null ? "N/A" : `${money(value)}/m³`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(periodMonthDate(value));
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Record<string, SearchValue> }) {
  await requireSuperAdmin();
  const todayMonth = indiaDateInput().slice(0, 7);
  const volumeRange = await prisma.monthlySalesVolume.aggregate({ _min: { periodMonth: true }, _max: { periodMonth: true } });
  const availableFrom = volumeRange._min.periodMonth?.toISOString().slice(0, 7) || todayMonth;
  const availableTo = volumeRange._max.periodMonth?.toISOString().slice(0, 7) || todayMonth;
  const requestedFrom = first(searchParams.from);
  const requestedTo = first(searchParams.to);
  const from = validMonth(requestedFrom) ? requestedFrom : availableFrom;
  const to = validMonth(requestedTo) ? requestedTo : availableTo;
  const periodError = from > to ? "From Month cannot be after To Month." : "";
  const employeeId = first(searchParams.employee);
  const plant = first(searchParams.plant);
  const location = first(searchParams.location);
  const selectedGlCodes = [...new Set(list(searchParams.gl))];

  const [employees, claimDimensions, volumeDimensions, claimTypes, batches] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { employeeId: true, name: true, plant: true, location: true }, orderBy: { name: "asc" } }),
    prisma.claimHeader.findMany({ where: { currentStatus: { in: approvedStatuses } }, select: { plant: true, location: true }, distinct: ["plant", "location"] }),
    prisma.monthlySalesVolume.findMany({ select: { plant: true, location: true }, distinct: ["plant", "location"] }),
    prisma.claimType.findMany({ where: { glCode: { not: null } }, select: { glCode: true, name: true }, orderBy: [{ glCode: "asc" }, { name: "asc" }] }),
    prisma.volumeUploadBatch.findMany({ orderBy: { uploadedAt: "desc" }, take: 8 })
  ]);
  const employeeOptions = employees.filter((employee) => employee.employeeId !== "SUPERADMIN" && !isWorkflowPlaceholderEmployeeId(employee.employeeId));
  const plants = [...new Set([...employees.map((item) => item.plant), ...claimDimensions.map((item) => item.plant), ...volumeDimensions.map((item) => item.plant)].filter(Boolean) as string[])].sort();
  const locations = [...new Set([...employees.map((item) => item.location), ...claimDimensions.map((item) => item.location), ...volumeDimensions.map((item) => item.location)].filter(Boolean) as string[])].sort();
  const glOptions = [...new Map(claimTypes.filter((item) => item.glCode).map((item) => [item.glCode!, { code: item.glCode!, name: item.name }])).values()];

  const claimHeaderWhere: Prisma.ClaimHeaderWhereInput = {
    currentStatus: { in: approvedStatuses },
    ...(employeeId ? { employeeId } : {}),
    ...(plant ? { plant } : {}),
    ...(location ? { location } : {})
  };
  const volumeWhere: Prisma.MonthlySalesVolumeWhereInput = {
    periodMonth: { gte: periodMonthDate(from), lte: periodMonthDate(to) },
    ...(employeeId ? { employeeId } : {}),
    ...(plant ? { plant } : {}),
    ...(location ? { location } : {})
  };

  const [claimLines, volumeRows] = periodError ? [[], []] : await Promise.all([
    prisma.claimLine.findMany({
      where: {
        claimDate: claimPeriod(from, to),
        claimHeader: claimHeaderWhere,
        ...(selectedGlCodes.length ? { claimType: { glCode: { in: selectedGlCodes } } } : {})
      },
      select: {
        claimHeaderId: true,
        claimDate: true,
        amount: true,
        gstAmount: true,
        claimType: { select: { glCode: true, name: true } },
        claimHeader: { select: { employeeId: true, employeeName: true, plant: true, location: true } }
      }
    }),
    prisma.monthlySalesVolume.findMany({ where: volumeWhere, orderBy: [{ periodMonth: "asc" }, { employeeName: "asc" }] })
  ]);

  const analytics = calculateAnalytics(
    claimLines.map((line) => ({
      claimHeaderId: line.claimHeaderId,
      claimDate: line.claimDate,
      amount: line.amount,
      gstAmount: line.gstAmount,
      glCode: line.claimType.glCode || "Unmapped",
      glName: line.claimType.name,
      employeeId: line.claimHeader.employeeId,
      employeeName: line.claimHeader.employeeName,
      plant: line.claimHeader.plant || "Unmapped",
      location: line.claimHeader.location || "Unmapped"
    })),
    volumeRows
  );

  return (
    <Shell title="Claims Analytics">
      <section className="card mb-4">
        <h2 className="mb-3 font-semibold">Monthly Sales Volume Upload</h2>
        <VolumeUploadPanel />
        <div className="mt-5 overflow-x-auto">
          <h3 className="mb-2 font-semibold">Recent Volume Uploads</h3>
          <table><thead><tr><th>Date</th><th>File</th><th>Valid</th><th>Errors</th><th>Imported</th><th>Status</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td>{formatIndiaDateTime(batch.uploadedAt)}</td><td>{batch.fileName}</td><td>{batch.validRows}</td><td>{batch.errorRows}</td><td>{batch.importedRows}</td><td>{batch.status}</td></tr>)}{!batches.length && <tr><td colSpan={6} className="text-center text-muted">No volume uploads yet.</td></tr>}</tbody></table>
        </div>
      </section>

      <form className="card mb-4 space-y-4" action="/analytics">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div><label>From Month</label><input type="month" name="from" defaultValue={from} required /></div>
          <div><label>To Month</label><input type="month" name="to" defaultValue={to} required /></div>
          <div><label>Employee</label><select name="employee" defaultValue={employeeId}><option value="">All Employees</option>{employeeOptions.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeId} - {employee.name}</option>)}</select></div>
          <div><label>Plant</label><select name="plant" defaultValue={plant}><option value="">All Plants</option>{plants.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div><label>Location</label><select name="location" defaultValue={location}><option value="">All Locations</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>
        <div>
          <label>GL Codes</label>
          <p className="mb-2 text-xs text-muted">Select any combination. Leave all unchecked to include every GL code.</p>
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded border border-line bg-panel p-3 sm:grid-cols-2 lg:grid-cols-3">{glOptions.map((item) => <label key={item.code} className="flex items-start gap-2 text-xs font-normal normal-case tracking-normal text-ink"><input className="mt-0.5 h-4 w-4" type="checkbox" name="gl" value={item.code} defaultChecked={selectedGlCodes.includes(item.code)} /><span><strong>{item.code}</strong> - {item.name}</span></label>)}</div>
        </div>
        <div className="flex flex-wrap gap-2"><button className="btn">Run Analytics</button><a className="btn-secondary" href="/analytics">Clear</a></div>
        {periodError && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{periodError}</div>}
      </form>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="PTD Period" value={`${monthLabel(from)} to ${monthLabel(to)}`} />
        <MetricCard label="Approved Amount + GST" value={money(analytics.totalAmount)} />
        <MetricCard label="Sales Volume" value={`${quantity(analytics.totalVolumeM3)} m³`} />
        <MetricCard label="Claim Cost / m³" value={rate(analytics.costPerM3)} />
      </div>
      {!periodError && analytics.totalVolumeM3 === 0 && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">No sales volume is available for the selected period and filters. Cost/m³ is shown as N/A.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Highest and Lowest Sales Employee Cost / m³</h2><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="Highest" value={analytics.highestEmployee ? `${analytics.highestEmployee.label}: ${rate(analytics.highestEmployee.costPerM3)}` : "N/A"} compact /><MetricCard label="Lowest" value={analytics.lowestEmployee ? `${analytics.lowestEmployee.label}: ${rate(analytics.lowestEmployee.costPerM3)}` : "N/A"} compact /></div><MetricTable rows={analytics.employeeRows} empty="No sales employee volume is available." /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Monthly PTD Trend</h2><MetricTable rows={analytics.monthlyRows} empty="No monthly claims or volume data found." /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Plant Cost / m³</h2><MetricTable rows={analytics.plantRows} empty="No plant volume is available." /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Location Cost / m³</h2><MetricTable rows={analytics.locationRows} empty="No location volume is available." /></section>
        <section className="card lg:col-span-2"><h2 className="mb-3 font-semibold">GL Code Analysis</h2><p className="mb-2 text-xs text-muted">Each GL uses the selected scope’s total sales volume. GL cost/m³ values should not be added together.</p><MetricTable rows={analytics.glRows} empty="No approved claim lines found." /></section>
      </div>
      <p className="mt-4 text-xs text-muted">PTD uses claim expense dates and adds monthly sales volume across the selected months. Claim cost includes line amount plus GST. Non-sales claims are included in plant, location and company totals; employees without sales volume show N/A individually. Approved claim count: {analytics.claimCount}.</p>
    </Shell>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className={`rounded border border-line bg-white ${compact ? "p-3" : "p-4"}`}><div className="text-xs font-semibold uppercase text-muted">{label}</div><div className={`${compact ? "text-base" : "text-xl"} mt-1 font-bold text-ink`}>{value}</div></div>;
}

function MetricTable({ rows, empty }: { rows: { key: string; label: string; amount: number; volumeM3: number; costPerM3: number | null }[]; empty: string }) {
  return <div className="mt-3 max-h-[28rem] overflow-auto"><table><thead><tr><th>Dimension</th><th>Amount + GST</th><th>Volume m³</th><th>Cost / m³</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.label}</td><td>{money(row.amount)}</td><td>{quantity(row.volumeM3)}</td><td>{rate(row.costPerM3)}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="text-center text-muted">{empty}</td></tr>}</tbody></table></div>;
}

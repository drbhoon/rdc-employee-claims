"use client";

import { useMemo, useState } from "react";

type ClaimTypeOption = {
  id: string;
  name: string;
};

export type EmployeeClaimLineValue = {
  id?: string;
  claimDate?: string;
  claimTypeId?: string;
  description?: string;
  amount?: string;
};

type ClaimLineRow = Required<EmployeeClaimLineValue> & {
  key: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newRow(): ClaimLineRow {
  return {
    key: crypto.randomUUID(),
    id: "",
    claimDate: today(),
    claimTypeId: "",
    description: "",
    amount: ""
  };
}

function initialRow(line: EmployeeClaimLineValue): ClaimLineRow {
  return {
    key: line.id || crypto.randomUUID(),
    id: line.id || "",
    claimDate: line.claimDate || today(),
    claimTypeId: line.claimTypeId || "",
    description: line.description || "",
    amount: line.amount || ""
  };
}

export function EmployeeClaimLines({
  claimTypes,
  initialLines = []
}: {
  claimTypes: ClaimTypeOption[];
  initialLines?: EmployeeClaimLineValue[];
}) {
  const [rows, setRows] = useState<ClaimLineRow[]>(() => (
    initialLines.length ? [...initialLines.map(initialRow), newRow()] : [newRow()]
  ));
  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [rows]);

  function updateRow(index: number, field: keyof Omit<ClaimLineRow, "key">, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="rounded-md border border-line bg-white px-4 py-3 text-right">
          <div className="text-xs font-semibold uppercase text-muted">Total Claim Amount</div>
          <div className="text-xl font-extrabold text-ink">INR {total.toFixed(2)}</div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-white">
        <table className="min-w-[1100px]">
          <thead>
            <tr>
              <th className="w-28">Date</th>
              <th className="w-[360px]">Type of Expenses - Employee</th>
              <th>Description</th>
              <th className="w-36">Amount</th>
              <th className="w-64">Supporting Document Upload</th>
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td>
                  <input type="hidden" name="lineId" value={row.id} />
                  <input type="date" name="claimDate" required value={row.claimDate} onChange={(event) => updateRow(index, "claimDate", event.target.value)} />
                </td>
                <td>
                  <select name="claimTypeId" value={row.claimTypeId} onChange={(event) => updateRow(index, "claimTypeId", event.target.value)}>
                    <option value="">Select expense</option>
                    {claimTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </td>
                <td><input name="description" placeholder="Short description" value={row.description} onChange={(event) => updateRow(index, "description", event.target.value)} /></td>
                <td><input type="number" step="0.01" min="0" name="amount" placeholder="0.00" value={row.amount} onChange={(event) => updateRow(index, "amount", event.target.value)} /></td>
                <td><input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png" /></td>
                <td className="text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    >
                      -
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-secondary text-lg leading-none"
        aria-label="Add claim row"
        onClick={() => setRows((current) => [...current, newRow()])}
      >
        +
      </button>
    </div>
  );
}

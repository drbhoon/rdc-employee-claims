"use client";

import { useState } from "react";

type ClaimTypeOption = {
  id: string;
  name: string;
};

export function EmployeeClaimLines({ claimTypes, today }: { claimTypes: ClaimTypeOption[]; today: string }) {
  const [rows, setRows] = useState([0]);

  return (
    <div className="space-y-3">
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
              <tr key={row}>
                <td>
                  <input type="hidden" name="claimDate" value={today} />
                  {new Date(today).toLocaleDateString("en-IN")}
                </td>
                <td>
                  <select name="claimTypeId">
                    <option value="">Select expense</option>
                    {claimTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </td>
                <td><input name="description" placeholder="Short description" /></td>
                <td><input type="number" step="0.01" min="0" name="amount" placeholder="0.00" /></td>
                <td><input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png" /></td>
                <td className="text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setRows((current) => current.filter((item) => item !== row))}
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
        onClick={() => setRows((current) => [...current, Date.now()])}
      >
        +
      </button>
    </div>
  );
}

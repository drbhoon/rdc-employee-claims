"use client";

import { useMemo, useState } from "react";

type EmployeeMasterUser = {
  employeeId: string;
  name: string;
  email: string | null;
  role: string;
  company: string | null;
  location: string | null;
  plant: string | null;
  costCenter: string | null;
  isActive: boolean;
};

export function EmployeeMasterPanel({ users }: { users: EmployeeMasterUser[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return users;
    return users.filter((user) =>
      [user.employeeId, user.name, user.email, user.role, user.company, user.location, user.plant, user.costCenter]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [query, users]);
  const visible = filtered.slice(0, 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64 flex-1">
          <label>Search employee by name, code or email</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing to find an employee" />
        </div>
        <a className="btn-secondary" href="/api/admin/employees/export">Download Employee Master</a>
      </div>
      <div className="text-sm text-muted">
        Showing {visible.length} of {filtered.length} matching employee{filtered.length === 1 ? "" : "s"} ({users.length} total).
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Company</th><th>Location / Plant</th><th>Cost Centre</th><th>Status</th></tr></thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.employeeId}>
                <td>{user.employeeId} - {user.name}</td>
                <td>{user.email || "-"}</td>
                <td>{user.role}</td>
                <td>{user.company || "-"}</td>
                <td>{[user.location, user.plant].filter(Boolean).join(" / ") || "-"}</td>
                <td>{user.costCenter || "-"}</td>
                <td>{user.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={7} className="text-center text-muted">No matching employees.</td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length > visible.length && <div className="text-sm text-muted">Refine the search to view results beyond the first 100.</div>}
    </div>
  );
}

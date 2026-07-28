"use client";

import { useMemo, useState } from "react";
import { updateUserPermissions } from "@/lib/actions";

type PermissionUser = {
  employeeId: string;
  name: string;
  email: string | null;
  canDownloadNationalReports: boolean;
  canUploadPayments: boolean;
};

export function UserPermissionPanel({ users }: { users: PermissionUser[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return users.slice(0, 20);
    return users.filter((user) => `${user.employeeId} ${user.name} ${user.email || ""}`.toLowerCase().includes(text)).slice(0, 20);
  }, [query, users]);

  return (
    <div className="space-y-3">
      <div><label>Search employee by name, code or email</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing to find an employee" /></div>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Employee</th><th>Email</th><th>Permissions</th></tr></thead>
          <tbody>
            {matches.map((user) => (
              <tr key={user.employeeId}>
                <td>{user.employeeId} - {user.name}</td><td>{user.email || "-"}</td>
                <td>
                  <form action={updateUserPermissions} className="flex flex-wrap items-center gap-4">
                    <input type="hidden" name="employeeId" value={user.employeeId} />
                    <label className="flex items-center gap-2"><input type="checkbox" name="canDownloadNationalReports" defaultChecked={user.canDownloadNationalReports} /> National report download</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="canUploadPayments" defaultChecked={user.canUploadPayments} /> Payment upload</label>
                    <button className="btn-secondary" type="submit">Save Rights</button>
                  </form>
                </td>
              </tr>
            ))}
            {!matches.length && <tr><td colSpan={3} className="text-center text-muted">No matching employees or delegated users.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

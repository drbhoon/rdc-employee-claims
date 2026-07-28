"use client";

import { useMemo, useState } from "react";
import { revokeUserPermission, updateUserPermissions } from "@/lib/actions";

type PermissionUser = {
  employeeId: string;
  name: string;
  email: string | null;
  canDownloadNationalReports: boolean;
  canUploadPayments: boolean;
};

export function UserPermissionPanel({ users, message }: { users: PermissionUser[]; message?: string }) {
  const [query, setQuery] = useState("");
  const delegatedUsers = useMemo(() => users.filter((user) => user.canDownloadNationalReports || user.canUploadPayments), [users]);
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (text.length < 2) return [];
    return users.filter((user) =>
      !user.canDownloadNationalReports &&
      !user.canUploadPayments &&
      `${user.employeeId} ${user.name} ${user.email || ""}`.toLowerCase().includes(text)
    ).slice(0, 20);
  }, [query, users]);

  return (
    <div className="space-y-3">
      {message && <div role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</div>}
      <div className="rounded border border-line bg-panel p-3">
        <h3 className="mb-2 font-semibold">Employees with delegated rights ({delegatedUsers.length})</h3>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th>Employee</th><th>Email</th><th>Granted Rights</th><th>Revoke</th></tr></thead>
            <tbody>
              {delegatedUsers.map((user) => <tr key={user.employeeId}>
                <td>{user.employeeId} - {user.name}</td>
                <td>{user.email || "-"}</td>
                <td>{[user.canDownloadNationalReports ? "National Report" : "", user.canUploadPayments ? "Payment Upload" : ""].filter(Boolean).join(", ")}</td>
                <td><div className="flex flex-wrap gap-2">
                  {user.canDownloadNationalReports && <form action={revokeUserPermission}><input type="hidden" name="employeeId" value={user.employeeId} /><input type="hidden" name="permission" value="nationalReport" /><button className="btn-secondary" type="submit">Revoke National Report</button></form>}
                  {user.canUploadPayments && <form action={revokeUserPermission}><input type="hidden" name="employeeId" value={user.employeeId} /><input type="hidden" name="permission" value="paymentUpload" /><button className="btn-secondary" type="submit">Revoke Payment Upload</button></form>}
                </div></td>
              </tr>)}
              {!delegatedUsers.length && <tr><td colSpan={4} className="text-center text-muted">No delegated rights have been granted.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div><label>Search employee to grant rights</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter at least 2 characters of name, code or email" /></div>
      {query.trim().length >= 2 && <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Employee</th><th>Email</th><th>Select Rights</th></tr></thead>
          <tbody>
            {matches.map((user) => (
              <tr key={user.employeeId}>
                <td>{user.employeeId} - {user.name}</td><td>{user.email || "-"}</td>
                <td>
                  <form action={updateUserPermissions} className="flex flex-wrap items-center gap-4">
                    <input type="hidden" name="employeeId" value={user.employeeId} />
                    <label className="flex items-center gap-2"><input type="checkbox" name="canDownloadNationalReports" defaultChecked={user.canDownloadNationalReports} /> National report download</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="canUploadPayments" defaultChecked={user.canUploadPayments} /> Payment upload</label>
                    <button className="btn-secondary" type="submit">Grant Selected Rights</button>
                  </form>
                </td>
              </tr>
            ))}
            {!matches.length && <tr><td colSpan={3} className="text-center text-muted">No matching employees without existing rights.</td></tr>}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

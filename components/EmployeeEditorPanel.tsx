"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type EditableEmployee = {
  employeeId: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  company: string | null;
  designation: string | null;
  location: string | null;
  plant: string | null;
  costCenter: string | null;
  accountsName: string | null;
  accountsEmail: string | null;
  rmName: string | null;
  rmEmail: string | null;
  level1Name: string | null;
  level1Email: string | null;
  level2Name: string | null;
  level2Email: string | null;
  isActive: boolean;
};

type FormEmployee = { [K in keyof EditableEmployee]: EditableEmployee[K] extends string | null ? string : EditableEmployee[K] };

function formValues(employee: EditableEmployee): FormEmployee {
  return Object.fromEntries(Object.entries(employee).map(([key, value]) => [key, value ?? ""])) as FormEmployee;
}

function newEmployeeForm(): FormEmployee {
  return {
    employeeId: "", name: "", email: "", mobile: "", role: "EMPLOYEE", company: "", designation: "",
    location: "", plant: "", costCenter: "", accountsName: "", accountsEmail: "", rmName: "", rmEmail: "",
    level1Name: "", level1Email: "", level2Name: "", level2Email: "", isActive: true
  };
}

export function EmployeeEditorPanel({ users }: { users: EditableEmployee[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<FormEmployee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const creating = form !== null && !selectedId;
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return users.filter((user) => user.employeeId.toLowerCase().includes(query)).slice(0, 10);
  }, [search, users]);

  function selectEmployee(employeeId: string) {
    const employee = users.find((item) => item.employeeId === employeeId);
    setSelectedId(employeeId);
    setForm(employee ? formValues(employee) : null);
    setSearch(employeeId);
    setNewPassword("");
    setMessage("");
  }

  function update(field: keyof FormEmployee, value: string | boolean) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }

  function startCreate() {
    setSearch("");
    setSelectedId("");
    setForm(newEmployeeForm());
    setNewPassword("");
    setMessage("");
  }

  function cancelForm() {
    setSearch("");
    setSelectedId("");
    setForm(null);
    setNewPassword("");
    setMessage("");
  }

  async function save() {
    if (!form) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(creating ? "/api/admin/employees" : `/api/admin/employees/${encodeURIComponent(form.employeeId)}`, {
        method: creating ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, password: newPassword })
      });
      const json = await response.json();
      if (!response.ok) return setMessage(json.error || `Employee ${creating ? "creation" : "update"} failed.`);
      setMessage(`${form.employeeId} ${creating ? "created" : "updated"} successfully.`);
      if (creating) {
        setForm(null);
        setNewPassword("");
        setSearch("");
      }
      router.refresh();
    } catch { setMessage(`Employee ${creating ? "creation" : "update"} failed. Please retry or check server logs.`); }
    finally { setBusy(false); }
  }

  const field = (label: string, name: keyof FormEmployee, type = "text", required = false) => (
    <div><label>{label}</label><input type={type} required={required} value={String(form?.[name] ?? "")} onChange={(event) => update(name, event.target.value)} /></div>
  );

  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Search and Edit Employee</h3><button type="button" className="btn" onClick={startCreate}>Add New Employee</button></div>
      {!creating && <div className="relative">
        <label>Employee Code</label>
        <input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(""); setForm(null); setMessage(""); }} placeholder="Type employee code" />
        {!selectedId && matches.length > 0 && <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-line bg-white shadow-lg">{matches.map((employee) => <button key={employee.employeeId} type="button" className="block w-full border-b border-line px-3 py-2 text-left hover:bg-panel" onClick={() => selectEmployee(employee.employeeId)}><strong>{employee.employeeId}</strong> — {employee.name}</button>)}</div>}
      </div>}
      {!form && <p className="mt-3 text-sm text-muted">Search by Employee Code and select an employee to edit, or add a new employee directly.</p>}
      {form && <div className="mt-4 space-y-3">
        {creating && <h4 className="text-lg font-semibold">Add New Employee</h4>}
        <div><label>Employee Code</label><input required value={form.employeeId} readOnly={!creating} className={creating ? "" : "bg-slate-100"} onChange={(event) => update("employeeId", event.target.value)} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          {field("Employee Name", "name", "text", true)}
          {field("Login ID / Email", "email", "email", true)}
          {field("Mobile", "mobile")}
          <div><label>Role</label><select value={form.role} onChange={(event) => update("role", event.target.value)}><option value="EMPLOYEE">Employee</option><option value="ACCOUNTS">Accounts</option><option value="APPROVER">Approver</option><option value="ADMIN">Admin</option></select></div>
          {field("Company", "company")}
          {field("Designation", "designation")}
          {field("Location", "location")}
          {field("Plant", "plant")}
          {field("Cost Centre", "costCenter")}
          {field("Accounts Name", "accountsName", "text", true)}
          {field("Accounts Email", "accountsEmail", "email", true)}
          {field("RM Name", "rmName")}
          {field("RM Email", "rmEmail", "email")}
          {field("Level 1 Name", "level1Name")}
          {field("Level 1 Email", "level1Email", "email")}
          {field("Level 2 / BH Name", "level2Name", "text", true)}
          {field("Level 2 / BH Email", "level2Email", "email", true)}
          <div><label>{creating ? "Initial Password" : "New Password"}</label><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={creating ? "Blank uses the default password" : "Leave blank to keep current password"} /></div>
        </div>
        <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Active employee</label>
        <div className="flex gap-2"><button type="button" className="btn" disabled={busy} onClick={save}>{busy ? "Saving..." : creating ? "Create Employee" : "Save Employee Changes"}</button><button type="button" className="btn-secondary" disabled={busy} onClick={cancelForm}>Cancel</button></div>
      </div>}
      {message && <div className="mt-3 rounded border border-line bg-white p-2 text-sm">{message}</div>}
    </div>
  );
}

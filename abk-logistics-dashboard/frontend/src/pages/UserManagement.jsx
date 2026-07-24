import React, { useEffect, useState } from "react";
import api from "../utils/api";

const EMPTY_FORM = { username: "", email: "", password: "", first_name: "", last_name: "", role: "viewer" };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const { data } = await api.get("/auth/users/");
    setUsers(data.results || data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/users/", form);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err) {
      alert(`Could not create user: ${JSON.stringify(err.response?.data || err.message)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = async (user) => {
    const newRole = user.role === "admin" ? "viewer" : "admin";
    await api.patch(`/auth/users/${user.id}/`, { role: newRole });
    refresh();
  };

  const toggleActive = async (user) => {
    await api.patch(`/auth/users/${user.id}/`, { is_active_dashboard_user: !user.is_active_dashboard_user });
    refresh();
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Remove ${user.username}? This cannot be undone.`)) return;
    await api.delete(`/auth/users/${user.id}/`);
    refresh();
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <h1 className="text-xl font-bold text-abk-navy">User Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-1">
          <h3 className="font-semibold text-abk-navy mb-3">Create User</h3>
          <form onSubmit={submit} className="space-y-3">
            <input required placeholder="Username" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.username} onChange={(e) => update("username", e.target.value)} />
            <input required type="email" placeholder="Email" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.email} onChange={(e) => update("email", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="First name" className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
              <input placeholder="Last name" className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
            <input required type="password" placeholder="Temporary password" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.password} onChange={(e) => update("password", e.target.value)} />
            <select className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={saving}
              className="w-full bg-abk-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-abk-navy2 disabled:opacity-50">
              {saving ? "Creating…" : "Create User"}
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
          <h3 className="font-semibold text-abk-navy mb-3">Dashboard Users ({users.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {["Username", "Email", "Role", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-2 py-1.5 font-medium">{u.username}</td>
                    <td className="px-2 py-1.5 text-slate-500">{u.email}</td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => toggleRole(u)}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.role === "admin" ? "bg-abk-navy text-white" : "bg-slate-100 text-slate-600"}`}>
                        {u.role}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => toggleActive(u)}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.is_active_dashboard_user ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {u.is_active_dashboard_user ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => deleteUser(u)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

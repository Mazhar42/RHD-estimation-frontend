import React, { useEffect, useState } from "react";
import { authAPI } from "../../api/auth";

export default function UserManagerPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await authAPI.getUsers();
      setUsers(res.data || []);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (createError) setCreateError("");
    if (success) setSuccess("");
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setCreateError("Username, email, and password are required");
      return;
    }
    try {
      setCreateError("");
      await authAPI.createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        full_name: form.full_name.trim() || null,
        password: form.password,
      });
      setForm({ username: "", email: "", full_name: "", password: "" });
      setSuccess("User created successfully");
      fetchUsers();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create user";
      setCreateError(msg);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">User Manager</h2>
      </div>

      <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-gray-600">Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            className="border border-gray-300 rounded w-full p-2 text-sm"
            placeholder="username"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="border border-gray-300 rounded w-full p-2 text-sm"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">Full Name</label>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            className="border border-gray-300 rounded w-full p-2 text-sm"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className="border border-gray-300 rounded w-full p-2 text-sm"
            placeholder="password"
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="bg-teal-700 hover:bg-teal-900 text-white text-sm font-medium px-4 py-2 rounded"
          >
            Create User
          </button>
          {createError && <span className="text-sm text-red-600">{createError}</span>}
          {success && <span className="text-sm text-emerald-600">{success}</span>}
        </div>
      </form>

      {loading && <div className="text-sm text-gray-600">Loading users...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Username</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Email</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Full Name</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Roles</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-teal-50">
                  <td className="px-3 py-2 text-gray-800">{u.username}</td>
                  <td className="px-3 py-2 text-gray-800">{u.email}</td>
                  <td className="px-3 py-2 text-gray-800">{u.full_name || "—"}</td>
                  <td className="px-3 py-2 text-gray-800">
                    {(u.roles || []).map((r) => r.name).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {u.is_active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

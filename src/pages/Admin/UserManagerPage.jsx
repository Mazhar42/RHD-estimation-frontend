import React, { useEffect, useState, useMemo } from "react";
import { authAPI } from "../../api/auth";
import { FaPlus, FaFilter, FaCog, FaSync, FaCheck, FaTimes, FaTrash, FaCopy, FaKey, FaUserTag } from "react-icons/fa";

export default function UserManagerPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [search, setSearch] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    activated: "",
    sso: "",
    password_expires: "",
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(300);

  // Modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoles, setEditingRoles] = useState([]);
  const [modalMode, setModalMode] = useState("create"); // create, edit, duplicate
  const [currentUserData, setCurrentUserData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: ""
  });
  const [passwordData, setPasswordData] = useState({
    new_password: "",
    confirm_password: ""
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await authAPI.getUsers();
      // Assuming res.data is [ { user_id, username, email, full_name, is_active, roles: [] } ]
      const mapped = (res.data || []).map(u => {
        const parts = (u.full_name || "").split(" ");
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ") || "";
        return {
          ...u,
          first_name: first,
          last_name: last,
        };
      });
      setUsers(mapped);
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      return (
        (!search.username || u.username.toLowerCase().includes(search.username.toLowerCase())) &&
        (!search.email || u.email.toLowerCase().includes(search.email.toLowerCase())) &&
        (!search.first_name || u.first_name.toLowerCase().includes(search.first_name.toLowerCase())) &&
        (!search.last_name || u.last_name.toLowerCase().includes(search.last_name.toLowerCase()))
      );
    });
  }, [users, search]);

  const toggleSelectUser = (id) => {
    setSelectedUserIds(prev => prev.includes(id) ? [] : [id]);
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.user_id));
    }
  };

  const handleAddUser = () => {
    setModalMode("create");
    setCurrentUserData({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      confirm_password: ""
    });
    setIsUserModalOpen(true);
  };

  const handleDuplicateUser = () => {
    if (selectedUserIds.length !== 1) return;
    const user = users.find(u => u.user_id === selectedUserIds[0]);
    if (!user) return;

    setModalMode("duplicate");
    setCurrentUserData({
      username: `${user.username}_copy`,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      password: "",
      confirm_password: ""
    });
    setIsUserModalOpen(true);
  };

  const handleChangePassword = () => {
    if (selectedUserIds.length === 0) return;
    setPasswordData({ new_password: "", confirm_password: "" });
    setIsPasswordModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (currentUserData.password !== currentUserData.confirm_password) {
      alert("Passwords do not match");
      return;
    }

    try {
      setActionLoading(true);
      const fullName = `${currentUserData.first_name} ${currentUserData.last_name}`.trim();
      const payload = {
        username: currentUserData.username,
        email: currentUserData.email,
        password: currentUserData.password,
        full_name: fullName
      };

      await authAPI.createUser(payload);
      await fetchUsers();
      setIsUserModalOpen(false);
      setCurrentUserData({ username: "", email: "", first_name: "", last_name: "", password: "", confirm_password: "" });
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to create user");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast("Passwords do not match", "error");
      return;
    }

    try {
      setActionLoading(true);
      // Since we don't have a bulk change password endpoint or admin change password endpoint without old password exposed in authAPI (it uses /change-password which requires old password),
      // we might need to check if we can update user.
      // authAPI.updateUser takes userId and userData. userData can have password.
      // So we can use updateUser for each selected user.
      
      const promises = selectedUserIds.map(id => 
        authAPI.updateUser(id, { password: passwordData.new_password })
      );
      
      await Promise.allSettled(promises);
      showToast("Password changed successfully", "success");
      setIsPasswordModalOpen(false);
      setPasswordData({ new_password: "", confirm_password: "" });
      setSelectedUserIds([]);
    } catch (err) {
      showToast("Failed to update passwords", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);

  const handleDeleteUsers = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUsers = async () => {
    try {
      setActionLoading(true);
      const promises = selectedUserIds.map(id => authAPI.deactivateUser(id));
      await Promise.allSettled(promises);
      await fetchUsers();
      setSelectedUserIds([]);
      setIsDeleteModalOpen(false);
    } catch (err) {
      alert("Failed to deactivate users");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ["Username", "Email", "First Name", "Last Name", "Active", "Roles"];
    const csvContent = [
      headers.join(","),
      ...filteredUsers.map(u => [
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active ? "Yes" : "No",
        (u.roles || []).map(r => r.name).join(";")
      ].map(f => `"${f}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "users_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const [showFilters, setShowFilters] = useState(false);

  const handleRefresh = () => {
    fetchUsers();
  };

  const fetchRoles = async () => {
    try {
      const res = await authAPI.getRoles();
      setRoles(res.data || []);
    } catch (e) {
      console.error("Failed to fetch roles", e);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleChangeRole = () => {
    if (selectedUserIds.length !== 1) return;
    const user = users.find(u => u.user_id === selectedUserIds[0]);
    if (!user) return;
    setEditingRoles((user.roles || []).map(r => r.role_id));
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length !== 1) return;
    const userId = selectedUserIds[0];
    
    try {
      setActionLoading(true);
      const user = users.find(u => u.user_id === userId);
      if (!user) return;
      
      const currentRoleIds = (user.roles || []).map(r => r.role_id);
      
      // Calculate roles to add and remove
      const toAdd = editingRoles.filter(id => !currentRoleIds.includes(id));
      const toRemove = currentRoleIds.filter(id => !editingRoles.includes(id));
      
      // Execute changes
      const promises = [
        ...toAdd.map(roleId => authAPI.assignRoleToUser(userId, roleId)),
        ...toRemove.map(roleId => authAPI.removeRoleFromUser(userId, roleId))
      ];
      
      await Promise.allSettled(promises);
      showToast("Roles updated successfully", "success");
      await fetchUsers();
      setIsRoleModalOpen(false);
    } catch (e) {
      showToast("Failed to update roles", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 relative min-h-[600px] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">User Admin</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleAddUser}
            className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-3 py-1 rounded shadow-sm inline-flex items-center gap-2"
          >
            <FaPlus className="w-3 h-3" /> Add User
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`border border-gray-300 text-sm font-medium px-3 py-1 rounded shadow-sm inline-flex items-center gap-2 ${showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <FaFilter className="w-3 h-3" /> Filter
          </button>
          <button 
            onClick={handleRefresh}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-3 py-1 rounded shadow-sm inline-flex items-center gap-2"
          >
            <FaSync className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm border-collapse table-fixed">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-2 py-2 text-center border-r border-gray-200">
                <input 
                  type="checkbox" 
                  onChange={toggleSelectAll}
                  checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[150px]">Login Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[200px]">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[120px]">First Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[120px]">Last Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">User Role</th>
            </tr>
            {showFilters && (
              <tr className="bg-gray-50">
                <th className="border-r border-gray-200 p-1"></th>
                <th className="border-r border-gray-200 p-1">
                  <input 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-normal" 
                    placeholder="Search..." 
                    value={search.username}
                    onChange={e => setSearch({...search, username: e.target.value})}
                  />
                </th>
                <th className="border-r border-gray-200 p-1">
                  <input 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-normal" 
                    placeholder="Search..."
                    value={search.email}
                    onChange={e => setSearch({...search, email: e.target.value})}
                  />
                </th>
                <th className="border-r border-gray-200 p-1">
                  <input 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-normal" 
                    placeholder="Search..."
                    value={search.first_name}
                    onChange={e => setSearch({...search, first_name: e.target.value})}
                  />
                </th>
                <th className="border-r border-gray-200 p-1">
                  <input 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-normal" 
                    placeholder="Search..."
                    value={search.last_name}
                    onChange={e => setSearch({...search, last_name: e.target.value})}
                  />
                </th>
                <th className="p-1"></th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading...</td></tr>
            ) : currentUsers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-500">No users found</td></tr>
            ) : (
              currentUsers.map((u) => {
                const isSelected = selectedUserIds.includes(u.user_id);
                return (
                  <tr key={u.user_id} className={`hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-2 text-center border-r border-gray-200">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelectUser(u.user_id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-800 border-r border-gray-200 truncate">{u.username}</td>
                    <td className="px-3 py-2 text-gray-800 border-r border-gray-200 truncate" title={u.email}>{u.email}</td>
                    <td className="px-3 py-2 text-gray-800 border-r border-gray-200 truncate">{u.first_name}</td>
                    <td className="px-3 py-2 text-gray-800 border-r border-gray-200 truncate">{u.last_name}</td>
                    <td className="px-3 py-2 text-gray-800 truncate">
                      {(u.roles && u.roles.length > 0) ? u.roles.map(r => r.name).join(", ") : "No Role"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between mt-4 gap-4 text-sm text-gray-600">
        <div>{filteredUsers.length} rows</div>
        <div className="flex items-center gap-2">
          <select 
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={300}>300 / page</option>
          </select>
          
          <div className="flex items-center gap-1 border border-gray-300 rounded bg-white">
            <button 
              className="px-3 py-1 border-r border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 border-r border-gray-300 last:border-r-0 hover:bg-gray-50 ${currentPage === i + 1 ? 'bg-indigo-50 text-indigo-600 font-medium' : ''}`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              className="px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <span>Go to</span>
            <input 
              type="number" 
              className="w-16 border border-gray-300 rounded px-2 py-1"
              min={1}
              max={totalPages}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages) setCurrentPage(val);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedUserIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-6 py-3 flex items-center gap-6 z-50 shadow-lg animate-slide-up">
          <div className="text-sm font-medium border-r border-gray-700 pr-6">
            {selectedUserIds.length} selected item(s)
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDeleteUsers}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded border border-gray-700 text-red-400 text-sm"
            >
              <FaTrash className="w-3 h-3" /> Delete
            </button>
            <button 
              onClick={handleDuplicateUser}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded border border-gray-700 text-sm ${selectedUserIds.length !== 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedUserIds.length !== 1}
            >
              <FaCopy className="w-3 h-3" /> Duplicate
            </button>
            <button 
              onClick={handleChangePassword}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded border border-gray-700 text-sm"
            >
              <FaKey className="w-3 h-3" /> Change Password
            </button>
            <button 
              onClick={handleChangeRole}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded border border-gray-700 text-sm ${selectedUserIds.length !== 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedUserIds.length !== 1}
            >
              <FaUserTag className="w-3 h-3" /> Change Role
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Confirm Deactivation</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to deactivate {selectedUserIds.length} user(s)? This action can be reversed by an administrator.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUsers}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                {actionLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              {modalMode === 'create' ? 'Add User' : 'Duplicate User'}
            </h3>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={currentUserData.first_name}
                    onChange={e => setCurrentUserData({...currentUserData, first_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={currentUserData.last_name}
                    onChange={e => setCurrentUserData({...currentUserData, last_name: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={currentUserData.username}
                  onChange={e => setCurrentUserData({...currentUserData, username: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={currentUserData.email}
                  onChange={e => setCurrentUserData({...currentUserData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required={modalMode === 'create' || modalMode === 'duplicate'}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={currentUserData.password}
                  onChange={e => setCurrentUserData({...currentUserData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  required={modalMode === 'create' || modalMode === 'duplicate'}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={currentUserData.confirm_password}
                  onChange={e => setCurrentUserData({...currentUserData, confirm_password: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Change Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Updating password for {selectedUserIds.length} user(s).
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={passwordData.new_password}
                  onChange={e => setPasswordData({...passwordData, new_password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={passwordData.confirm_password}
                  onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  {actionLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Change Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Manage Roles</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select roles for the user.
            </p>
            <form onSubmit={handleRoleSubmit} className="space-y-3">
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded p-2">
                {roles.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No roles available.</p>
                ) : (
                  roles.map(role => (
                    <label key={role.role_id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="radio"
                        name="role_selection"
                        checked={editingRoles.includes(role.role_id)}
                        onChange={() => setEditingRoles([role.role_id])}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{role.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  {actionLoading ? 'Saving...' : 'Save Roles'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-[100] transition-opacity duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

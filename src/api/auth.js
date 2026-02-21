import { apiClient } from './axios';

const BASE_PATH = '/auth';

export const authAPI = {
  login: (username, password) => {
    // Send as x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return apiClient.post(`${BASE_PATH}/login`, formData);
  },

  register: (username, email, password, fullName = '') =>
    apiClient.post(`${BASE_PATH}/register`, {
      username,
      email,
      password,
      full_name: fullName,
    }),

  getMe: () =>
    apiClient.get(`${BASE_PATH}/me`),

  changePassword: (oldPassword, newPassword) =>
    apiClient.post(`${BASE_PATH}/change-password`, {
      old_password: oldPassword,
      new_password: newPassword,
    }),

  // User management (admin only)
  createUser: (userData) =>
    apiClient.post(`${BASE_PATH}/users`, userData),

  getUsers: (skip = 0, limit = 100) =>
    apiClient.get(`${BASE_PATH}/users`, { params: { skip, limit } }),

  getUser: (userId) =>
    apiClient.get(`${BASE_PATH}/users/${userId}`),

  updateUser: (userId, userData) =>
    apiClient.put(`${BASE_PATH}/users/${userId}`, userData),

  deactivateUser: (userId) =>
    apiClient.post(`${BASE_PATH}/users/${userId}/deactivate`),

  activateUser: (userId) =>
    apiClient.post(`${BASE_PATH}/users/${userId}/activate`),

  // Role management (admin only)
  createRole: (roleData) =>
    apiClient.post(`${BASE_PATH}/roles`, roleData),

  getRoles: (skip = 0, limit = 100) =>
    apiClient.get(`${BASE_PATH}/roles`, { params: { skip, limit } }),

  getRole: (roleId) =>
    apiClient.get(`${BASE_PATH}/roles/${roleId}`),

  updateRole: (roleId, roleData) =>
    apiClient.put(`${BASE_PATH}/roles/${roleId}`, roleData),

  deleteRole: (roleId) =>
    apiClient.delete(`${BASE_PATH}/roles/${roleId}`),

  assignRoleToUser: (userId, roleId) =>
    apiClient.post(`${BASE_PATH}/users/${userId}/roles/${roleId}`),

  removeRoleFromUser: (userId, roleId) =>
    apiClient.delete(`${BASE_PATH}/users/${userId}/roles/${roleId}`),

  // Permission management (admin only)
  createPermission: (permissionData) =>
    apiClient.post(`${BASE_PATH}/permissions`, permissionData),

  getPermissions: (skip = 0, limit = 100) =>
    apiClient.get(`${BASE_PATH}/permissions`, { params: { skip, limit } }),

  assignPermissionToRole: (roleId, permissionId) =>
    apiClient.post(`${BASE_PATH}/roles/${roleId}/permissions/${permissionId}`),

  removePermissionFromRole: (roleId, permissionId) =>
    apiClient.delete(`${BASE_PATH}/roles/${roleId}/permissions/${permissionId}`),
};

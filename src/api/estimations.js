import { apiClient } from "./axios";

export const listEstimationLines = async (estimationId) => {
  const res = await apiClient.get(`/estimations/${estimationId}/lines`);
  return res.data;
};

export const createEstimationLine = async (estimationId, data) => {
  const res = await apiClient.post(`/estimations/${estimationId}/lines`, data);
  return res.data;
};

export const updateEstimationLine = async (lineId, data) => {
  const res = await apiClient.put(`/estimations/lines/${lineId}`, data);
  return res.data;
};

export const deleteEstimationLines = async (lineIds) => {
  const res = await apiClient.delete(`/estimations/lines`, { data: { line_ids: lineIds } });
  return res.data;
};

export const getEstimationTotal = async (estimationId) => {
  const res = await apiClient.get(`/estimations/${estimationId}/total`);
  return res.data;
};

export const getEstimation = async (estimationId) => {
  const res = await apiClient.get(`/estimations/${estimationId}`);
  return res.data;
};

export const deleteEstimation = async (estimationId) => {
  const res = await apiClient.delete(`/estimations/${estimationId}`);
  return res.data;
};

export const updateEstimation = async (estimationId, data) => {
  const res = await apiClient.patch(`/estimations/${estimationId}`, data);
  return res.data;
};

// Special Items
export const listSpecialItemRequests = async (estimationId, status) => {
  const params = status ? { status } : {};
  const res = await apiClient.get(`/estimations/${estimationId}/special-item-requests`, { params });
  return res.data;
};

export const listAllSpecialItemRequests = async (status) => {
  const params = status ? { status } : {};
  const res = await apiClient.get(`/estimations/special-item-requests/all`, { params });
  return res.data;
};

export const createSpecialItemRequest = async (estimationId, data) => {
  const res = await apiClient.post(`/estimations/${estimationId}/special-item-requests`, data);
  return res.data;
};

export const approveSpecialItemRequest = async (requestId) => {
  const res = await apiClient.post(`/estimations/special-item-requests/${requestId}/approve`);
  return res.data;
};

export const rejectSpecialItemRequest = async (requestId, reason) => {
  const res = await apiClient.post(`/estimations/special-item-requests/${requestId}/reject`, { reason });
  return res.data;
};

export const updateSpecialItemRequest = async (requestId, data) => {
  const res = await apiClient.put(`/estimations/special-item-requests/${requestId}`, data);
  return res.data;
};

export const deleteSpecialItemRequest = async (requestId) => {
  const res = await apiClient.delete(`/estimations/special-item-requests/${requestId}`);
  return res.data;
};

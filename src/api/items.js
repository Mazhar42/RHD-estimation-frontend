import { apiClient } from "./axios";

export const listDivisions = async () => {
  const res = await apiClient.get(`/items/divisions`);
  return res.data;
};

export const listItems = async (params = {}) => {
  const res = await apiClient.get(`/items`, { params });
  return res.data;
};

export const createItem = async (payload) => {
  const res = await apiClient.post(`/items`, payload);
  return res.data;
};

export const importItems = async (file, mode = "append", onUploadProgress) => {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await apiClient.post(`/items/import`, form, {
      params: { mode },
      headers: {}, // Let axios automatically set Content-Type with proper boundary
      onUploadProgress: onUploadProgress,
      timeout: 300000, // 5 minute timeout for large file processing
    });
    return res.data;
  } catch (error) {
    console.error(
      "[API] importItems error:",
      error.message,
      error.response?.status,
    );
    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Import request timed out. The file might be too large or the server is taking too long to process.",
      );
    }
    throw error;
  }
};

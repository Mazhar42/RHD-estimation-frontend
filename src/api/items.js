import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export const listDivisions = async () => {
  const res = await axios.get(`${API_BASE}/items/divisions`);
  return res.data;
};

export const listItems = async (params = {}) => {
  const res = await axios.get(`${API_BASE}/items`, { params });
  return res.data;
};

export const importItems = async (file, mode = "append") => {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${API_BASE}/items/import`, form, {
    params: { mode },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export async function listOrganizations() {
  const res = await axios.get(`${API}/orgs`);
  return res.data; // [{ org_id, name }]
}

export async function listRegions(orgId) {
  const res = await axios.get(`${API}/orgs/${orgId}/regions`);
  return res.data; // [{ region_id, name, organization_id }]
}

export async function createRegion(orgId, name) {
  const res = await axios.post(`${API}/orgs/${orgId}/regions`, { name });
  return res.data; // { region_id, name, organization_id }
}

export async function deleteRegion(regionId) {
  const res = await axios.delete(`${API}/orgs/regions/${regionId}`);
  return res.data; // deleted region
}

export async function createOrganization(name) {
  const res = await axios.post(`${API}/orgs`, { name });
  return res.data; // { org_id, name }
}

export async function deleteOrganization(orgId) {
  const res = await axios.delete(`${API}/orgs/${orgId}`);
  return res.data; // deleted org
}

export async function updateOrganization(orgId, name) {
  const res = await axios.patch(`${API}/orgs/${orgId}`, { name });
  return res.data; // updated org
}

export async function updateRegion(regionId, name) {
  const res = await axios.patch(`${API}/orgs/regions/${regionId}`, { name });
  return res.data; // updated region
}

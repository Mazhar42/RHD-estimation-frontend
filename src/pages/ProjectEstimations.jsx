import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaTrash, FaPlus, FaEdit } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function ProjectEstimations() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [estimations, setEstimations] = useState([]);
  const [name, setName] = useState("");
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [projectName, setProjectName] = useState("");
  const [isCreateEstimationModalOpen, setIsCreateEstimationModalOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [estimationToDelete, setEstimationToDelete] = useState(null);
  const [isEditEstimationModalOpen, setIsEditEstimationModalOpen] = useState(false);
  const [editEstimationId, setEditEstimationId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetchEstimations();
    fetchRegions();
    fetchProjectName();
  }, [projectId]);

  const fetchEstimations = async () => {
    const res = await axios.get(`${API}/projects/${projectId}/estimations`);
    setEstimations(res.data);
  };

  const fetchRegions = async () => {
    try {
      const res = await axios.get(`${API}/items`, { params: { limit: 10000 } });
      const unique = Array.from(new Set(res.data.map(it => it.region))).filter(Boolean).sort();
      setRegions(unique);
    } catch (e) {
      console.error('Failed to load regions', e);
    }
  };

  const fetchProjectName = async () => {
    try {
      const res = await axios.get(`${API}/projects`);
      const proj = (res.data || []).find(p => String(p.project_id) === String(projectId));
      if (proj) setProjectName(proj.project_name || "");
    } catch (e) {
      console.error('Failed to load project name', e);
    }
  };

  // New: create estimation with optional name (auto default) and mandatory region
  const createEstimationWithDefault = async (e) => {
    e.preventDefault();
    if (!selectedRegion) {
      setCreateError("Region should not be empty");
      return;
    }
    const defaultName = `Estimation #${(estimations?.length || 0) + 1}`;
    const estimationNameToSend = (name && name.trim()) ? name.trim() : defaultName;
    const res = await axios.post(`${API}/projects/${projectId}/estimations`, { estimation_name: estimationNameToSend });
    const created = res.data;
    try {
      localStorage.setItem(`estimationRegion:${created.estimation_id}`, selectedRegion);
      localStorage.setItem(`estimationName:${created.estimation_id}`, estimationNameToSend);
    } catch {}
    setName("");
    setCreateError("");
    setIsCreateEstimationModalOpen(false);
    fetchEstimations();
  };

  // Key handling for Create Estimation modal: Esc closes, Enter submits
  useEffect(() => {
    if (!isCreateEstimationModalOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setIsCreateEstimationModalOpen(false);
      } else if (e.key === 'Enter') {
        const form = document.getElementById('create-estimation-form');
        if (form) {
          e.preventDefault();
          if (form.requestSubmit) form.requestSubmit(); else form.submit();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCreateEstimationModalOpen]);

  // Key handling for Delete Confirmation modal: Esc closes, Enter confirms delete
  useEffect(() => {
    if (!isDeleteConfirmOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setIsDeleteConfirmOpen(false);
        setEstimationToDelete(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (estimationToDelete) {
          (async () => {
            try {
              await axios.delete(`${API}/estimations/${estimationToDelete.id}`);
              setIsDeleteConfirmOpen(false);
              setEstimationToDelete(null);
              fetchEstimations();
            } catch (err) {
              console.error('Failed to delete estimation', err);
            }
          })();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDeleteConfirmOpen, estimationToDelete]);

  const createEstimation = async (e) => {
    e.preventDefault();
    if (!name || !selectedRegion) {
      setCreateError(!selectedRegion ? "Region should not be empty" : "Estimation name is required");
      return;
    }
    const res = await axios.post(`${API}/projects/${projectId}/estimations`, { estimation_name: name });
    const created = res.data;
    try {
      localStorage.setItem(`estimationRegion:${created.estimation_id}`, selectedRegion);
    } catch {}
    setName("");
    setCreateError("");
    setIsCreateEstimationModalOpen(false);
    fetchEstimations();
  };

  const openDeleteConfirm = (id, name) => {
    setEstimationToDelete({ id, name });
    setIsDeleteConfirmOpen(true);
  };
  const confirmDeleteEstimation = async () => {
    if (!estimationToDelete) return;
    try {
      await axios.delete(`${API}/estimations/${estimationToDelete.id}`);
      setIsDeleteConfirmOpen(false);
      setEstimationToDelete(null);
      fetchEstimations();
    } catch (err) {
      console.error('Failed to delete estimation', err);
    }
  };
  const cancelDeleteEstimation = () => {
    setIsDeleteConfirmOpen(false);
    setEstimationToDelete(null);
  };

  const openEditEstimation = (es) => {
    setEditEstimationId(es.estimation_id);
    const currentRegion = localStorage.getItem(`estimationRegion:${es.estimation_id}`) || "";
    setEditRegion(currentRegion);
    setEditName(es.estimation_name || "");
    setEditError("");
    setIsEditEstimationModalOpen(true);
  };

  const submitEditEstimation = async (e) => {
    e.preventDefault();
    if (!editRegion) {
      setEditError("Region should not be empty");
      return;
    }
    try {
      await axios.patch(`${API}/estimations/${editEstimationId}`, { estimation_name: editName || `Estimation #${editEstimationId}` });
      try {
        localStorage.setItem(`estimationRegion:${editEstimationId}`, editRegion);
        if (editName) localStorage.setItem(`estimationName:${editEstimationId}`, editName);
      } catch {}
      setIsEditEstimationModalOpen(false);
      setEditEstimationId(null);
      setEditName("");
      setEditRegion("");
      setEditError("");
      fetchEstimations();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to update estimation";
      setEditError(msg);
    }
  };

  return (
    <div className="relative bg-white p-4 sm:p-6 -mx-6 -mb-6 w-[calc(100%+3rem)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Estimations for Project : {projectName || `#${projectId}`}</h2>
        <button
          onClick={() => { setIsCreateEstimationModalOpen(true); setCreateError(""); setSelectedRegion(""); }}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1"
        >
          <FaPlus className="w-3 h-3" />
          <span>Create Estimation</span>
        </button>
      </div>

      {isCreateEstimationModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsCreateEstimationModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Create Estimation</h2>
            <p className="text-xs text-gray-600 mb-3">Estimation name (optional) and Region (mandatory).</p>
            {createError && (
              <p className="mb-3 text-sm text-red-600">{createError}</p>
            )}
            <form id="create-estimation-form" onSubmit={createEstimationWithDefault} className="grid grid-cols-1 gap-3 mt-2">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); if (createError && e.target.value.trim()) setCreateError(""); }}
                placeholder="Estimation name"
                className="border border-gray-300 focus:ring-teal-500 p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm"
              />
              <select
                value={selectedRegion}
                onChange={(e) => { setSelectedRegion(e.target.value); if (createError && e.target.value) setCreateError(""); }}
                className={`border ${createError && !selectedRegion ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm`}
              >
                {regions.length === 0 ? <option value="">Loading regions…</option> : (
                  <>
                    <option value="">Select Region</option>
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </>
                )}
              </select>
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateEstimationModalOpen(false)}
                  className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
                  disabled={!selectedRegion}
                >
                  <FaPlus className="w-3 h-3" />
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md z-50 relative border border-gray-200">
            <button onClick={cancelDeleteEstimation} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Delete Estimation</h2>
            <p className="text-sm text-gray-700 mb-4">Are you sure you want to delete
              <span className="font-semibold"> {estimationToDelete?.name || `Estimation #${estimationToDelete?.id}`} </span>?
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDeleteEstimation}
                className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEstimation}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditEstimationModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsEditEstimationModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Edit Estimation</h2>
            <p className="text-xs text-gray-600 mb-3">Update estimation name (optional) and Region (mandatory).</p>
            {editError && (
              <p className="mb-3 text-sm text-red-600">{editError}</p>
            )}
            <form onSubmit={submitEditEstimation} className="grid grid-cols-1 gap-3 mt-2">
              <input
                value={editName}
                onChange={(e) => { setEditName(e.target.value); if (editError && e.target.value.trim()) setEditError(""); }}
                placeholder="Estimation name"
                className="border border-gray-300 focus:ring-teal-500 p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm"
              />
              <select
                value={editRegion}
                onChange={(e) => { setEditRegion(e.target.value); if (editError && e.target.value) setEditError(""); }}
                className={`border ${editError && !editRegion ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm`}
              >
                {regions.length === 0 ? <option value="">Loading regions…</option> : (
                  <>
                    <option value="">Select Region</option>
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </>
                )}
              </select>
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditEstimationModalOpen(false)}
                  className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
                  disabled={!editRegion}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table replacing card layout, mirroring the Projects table style */}
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Estimation Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Region</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Created By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Created At</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Updated By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Updated At</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {estimations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-600">No estimations found</td>
                </tr>
              ) : (
                estimations.map((es, i) => (
                  <tr key={es.estimation_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors`}>
                    <td className="px-3 py-2 text-xs text-teal-700 font-medium whitespace-nowrap">
                      <Link
                        to={`/estimations/${es.estimation_id}?region=${encodeURIComponent(localStorage.getItem(`estimationRegion:${es.estimation_id}`) || '')}`}
                        className="hover:underline"
                      >
                        {es.estimation_name || `Estimation #${es.estimation_id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">{localStorage.getItem(`estimationRegion:${es.estimation_id}`) || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded"
                          onClick={() => openEditEstimation(es)}
                          title="Edit Estimation"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded"
                          onClick={() => openDeleteConfirm(es.estimation_id, es.estimation_name)}
                          title="Delete Estimation"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

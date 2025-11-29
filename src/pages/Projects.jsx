import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaPlus, FaEdit } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ project_name: "", client_name: "" });
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [addProjectError, setAddProjectError] = useState("");
  const [isConfirmDeleteProjectOpen, setIsConfirmDeleteProjectOpen] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState(null);
  // Selection for possible single-row actions (no mass delete requested)
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ project_name: "", client_name: "" });
  const [editProjectError, setEditProjectError] = useState("");

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    const res = await axios.get(`${API}/projects`);
    setProjects(res.data);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addProject = async (e) => {
    e.preventDefault();
    if (!form.project_name.trim()) {
      setAddProjectError("Project name is required");
      return;
    }
    try {
      await axios.post(`${API}/projects`, form);
      setForm({ project_name: "", client_name: "" });
      setIsAddProjectModalOpen(false);
      fetchProjects();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to add project";
      setAddProjectError(msg);
    }
  };

  const requestDeleteProject = (project) => {
    setProjectPendingDelete(project);
    setIsConfirmDeleteProjectOpen(true);
  };

  const performDeleteProject = async () => {
    if (!projectPendingDelete) return;
    await axios.delete(`${API}/projects/${projectPendingDelete.project_id}`);
    setIsConfirmDeleteProjectOpen(false);
    setProjectPendingDelete(null);
    fetchProjects();
  };

  // Close modal on Escape
  useEffect(() => {
    if (!isAddProjectModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsAddProjectModalOpen(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const formEl = document.getElementById("add-project-form");
        if (formEl) formEl.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddProjectModalOpen]);

  // Close delete confirm on Escape
  useEffect(() => {
    if (!isConfirmDeleteProjectOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsConfirmDeleteProjectOpen(false);
        setProjectPendingDelete(null);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        performDeleteProject();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfirmDeleteProjectOpen]);

  // ... (inside the component)

  const openEditProject = (project) => {
    setSelectedProjectId(project.project_id);
    setEditProjectForm({ project_name: project.project_name || "", client_name: project.client_name || "" });
    setEditProjectError("");
    setIsEditProjectModalOpen(true);
  };

  const submitEditProject = async (e) => {
    e.preventDefault();
    if (!editProjectForm.project_name.trim()) {
      setEditProjectError("Project name is required");
      return;
    }
    try {
      await axios.patch(`${API}/projects/${selectedProjectId}`, editProjectForm);
      setIsEditProjectModalOpen(false);
      setSelectedProjectId(null);
      setEditProjectForm({ project_name: "", client_name: "" });
      fetchProjects();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to update project";
      setEditProjectError(msg);
    }
  };

  return (
    <div className="relative bg-white p-4 sm:p-6 -mx-6 -mb-6 w-[calc(100%+3rem)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          onClick={() => { setIsAddProjectModalOpen(true); setAddProjectError(""); }}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1"
        >
          <FaPlus className="w-3 h-3" />
          <span>Add Project</span>
        </button>
      </div>

      {isAddProjectModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsAddProjectModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Add New Project</h2>
            <p className="text-xs text-gray-600 mb-3">Specify the project name and client.</p>
            {addProjectError && (
              <p className="mb-3 text-sm text-red-600">{addProjectError}</p>
            )}
            <form id="add-project-form" onSubmit={addProject} className="grid grid-cols-1 gap-3 mt-2">
              <input
                name="project_name"
                value={form.project_name}
                onChange={(e) => { handleChange(e); if (addProjectError && e.target.value.trim()) setAddProjectError(""); }}
                placeholder="Project name"
                className={`border ${addProjectError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm`}
              />
              <input
                name="client_name"
                value={form.client_name}
                onChange={handleChange}
                placeholder="Client name"
                className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddProjectModalOpen(false)}
                  className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
                >
                  <FaPlus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditProjectModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsEditProjectModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Edit Project</h2>
            <p className="text-xs text-gray-600 mb-3">Update the project name and client.</p>
            {editProjectError && (
              <p className="mb-3 text-sm text-red-600">{editProjectError}</p>
            )}
            <form onSubmit={submitEditProject} className="grid grid-cols-1 gap-3 mt-2">
              <input
                name="project_name"
                value={editProjectForm.project_name}
                onChange={(e) => { setEditProjectForm({ ...editProjectForm, project_name: e.target.value }); if (editProjectError && e.target.value.trim()) setEditProjectError(""); }}
                placeholder="Project name"
                className={`border ${editProjectError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-sm`}
              />
              <input
                name="client_name"
                value={editProjectForm.client_name}
                onChange={(e) => setEditProjectForm({ ...editProjectForm, client_name: e.target.value })}
                placeholder="Client name"
                className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditProjectModalOpen(false)}
                  className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfirmDeleteProjectOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md z-50 relative border border-gray-200">
            <button onClick={() => { setIsConfirmDeleteProjectOpen(false); setProjectPendingDelete(null); }} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Delete Project</h2>
            <p className="text-sm text-gray-700 mb-4">
              <span className="font-medium">Warning:</span> Project "{projectPendingDelete?.project_name || `#${projectPendingDelete?.project_id}`}" will be deleted permanently. This action cannot be undone.
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setIsConfirmDeleteProjectOpen(false); setProjectPendingDelete(null); }}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performDeleteProject}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table replacing card layout, similar style to Item list */}
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Project Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Client Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Project Created By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Created At</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Updated By</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 whitespace-nowrap">Updated At</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-600">No projects found</td>
                </tr>
              ) : (
                projects.map((p, i) => (
                  <tr key={p.project_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors`}>
                    <td className="px-3 py-2 text-xs text-teal-700 font-medium whitespace-nowrap">
                      <Link to={`/projects/${p.project_id}/estimations`} className="hover:underline">
                        {p.project_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">{p.client_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded"
                          onClick={() => openEditProject(p)}
                          title="Edit Project"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded"
                          onClick={() => requestDeleteProject(p)}
                          title="Delete Project"
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

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ project_name: "", client_name: "" });

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    const res = await axios.get(`${API}/projects`);
    setProjects(res.data);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addProject = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/projects`, form);
    setForm({ project_name: "", client_name: "" });
    fetchProjects();
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Projects</h2>
      <form onSubmit={addProject} className="grid grid-cols-3 gap-2 mb-4">
        <input name="project_name" value={form.project_name} onChange={handleChange} placeholder="Project name" className="border p-2 rounded col-span-2" />
        <input name="client_name" value={form.client_name} onChange={handleChange} placeholder="Client name" className="border p-2 rounded" />
        <div className="col-span-3 text-right">
          <button className="bg-green-600 text-white px-4 py-2 rounded">Add Project</button>
        </div>
      </form>

      <div className="space-y-2">
        {projects.map(p => (
          <div key={p.project_id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{p.project_name}</div>
              <div className="text-sm text-gray-600">{p.client_name}</div>
            </div>
            <div>
              <Link to={`/projects/${p.project_id}/estimations`} className="bg-blue-600 text-white px-3 py-1 rounded">Open</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

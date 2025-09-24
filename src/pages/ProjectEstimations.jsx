import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { FaTrash } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function ProjectEstimations() {
  const { projectId } = useParams();
  const [estimations, setEstimations] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchEstimations();
  }, [projectId]);

  const fetchEstimations = async () => {
    const res = await axios.get(`${API}/projects/${projectId}/estimations`);
    setEstimations(res.data);
  };

  const createEstimation = async (e) => {
    e.preventDefault();
    if (!name) return;
    await axios.post(`${API}/projects/${projectId}/estimations`, { estimation_name: name });
    setName("");
    fetchEstimations();
  };

  const deleteEstimation = async (estimation_id) => {
    if (window.confirm("Are you sure you want to delete this estimation?")) {
      await axios.delete(`${API}/estimations/${estimation_id}`);
      fetchEstimations();
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Estimations for Project #{projectId}</h2>
      <form onSubmit={createEstimation} className="flex gap-2 mb-4">
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Estimation name" className="border p-2 rounded flex-1" />
        <button className="bg-teal-600 text-white px-4 rounded">Create</button>
      </form>

      <div className="space-y-2">
        {estimations.map(es => (
          <div key={es.estimation_id} className="p-3 border rounded flex justify-between items-center">
            <div>{es.estimation_name}</div>
            <div className="flex items-center gap-2">
              <Link to={`/estimations/${es.estimation_id}`} className="bg-teal-600 text-white px-3 py-1 rounded">Open</Link>
              <button onClick={() => deleteEstimation(es.estimation_id)} className="text-red-500 hover:text-red-700"><FaTrash /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

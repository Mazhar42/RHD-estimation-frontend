import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Products from "./pages/Products";
import Projects from "./pages/Projects";
import ProjectEstimations from "./pages/ProjectEstimations";
import EstimationDetail from "./pages/EstimationDetail";
import Sidebar from "./components/Sidebar";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">RHD Estimation App</h1>
          <nav className="space-x-4">
            <Link to="/products" className="text-sm text-blue-600">Products</Link>
            <Link to="/projects" className="text-sm text-blue-600">Projects</Link>
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/products" element={<Products />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId/estimations" element={<ProjectEstimations />} />
          <Route path="/estimations/:estimationId" element={<EstimationDetail />} />
        </Routes>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Products from "./pages/Products";
import Projects from "./pages/Projects";
import ProjectEstimations from "./pages/ProjectEstimations";
import EstimationDetail from "./pages/EstimationDetail";
import Sidebar from "./components/Sidebar";

export default function App() {


  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-teal-100 p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-900">RHD Estimation App</h1>
        <nav className="space-x-4">
          <Link to="/products" className="text-sm text-teal-800">Products</Link>
          <Link to="/projects" className="text-sm text-teal-800">Projects</Link>
        </nav>
      </header>
      <div className="p-6">
        <Routes>
          <Route path="/" element={<Products />} />
          <Route
            path="/products"
            element={<Products />}
          />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId/estimations" element={<ProjectEstimations />} />
          <Route path="/estimations/:estimationId" element={<EstimationDetail />} />
        </Routes>
      </div>
    </div>
  );
}

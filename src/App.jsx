import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Products from "./pages/Products";
import Projects from "./pages/Projects";
import ProjectEstimations from "./pages/ProjectEstimations";
import EstimationDetail from "./pages/EstimationDetail";

export default function App() {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!isLauncherOpen) return;

    const container = launcherRef.current;
    if (container) {
      const focusables = container.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        // Focus the first actionable element for accessibility
        const firstEl = focusables[0];
        if (firstEl && typeof firstEl.focus === 'function') firstEl.focus();
      }
    }

    const onKeyDown = (e) => {
      if (!launcherRef.current) return;
      const focusables = launcherRef.current.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsLauncherOpen(false);
        return;
      }
      if (e.key === 'Tab' && focusables.length > 0) {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last && last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first && first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isLauncherOpen]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-teal-900 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLauncherOpen(true)}
            className="p-1 rounded hover:bg-teal-800 focus:outline-none"
            aria-label="Open dashboard"
            title="Open dashboard"
          >
            <div className="grid grid-cols-3 gap-0.5">
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
              <span className="w-1 h-1 bg-white/90 rounded-full"></span>
            </div>
          </button>
          <div className="flex items-baseline gap-2 leading-tight">
            <h1 className="text-sm font-bold text-white">RHD-CES</h1>
            <span className="text-xs text-white/80">Cost Estimtation System</span>
          </div>
        </div>
        {/* Right-corner navigation */}
        <nav className="flex items-center gap-2">
          <Link
            to="/products"
            className="text-xs px-3 py-1 rounded text-white hover:bg-teal-800 focus:outline-none focus:ring-1 focus:ring-white/60"
            aria-label="Go to Items"
          >
            Items
          </Link>
          <Link
            to="/projects"
            className="text-xs px-3 py-1 rounded text-white hover:bg-teal-800 focus:outline-none focus:ring-1 focus:ring-white/60"
            aria-label="Go to Projects"
          >
            Projects
          </Link>
          
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

      {isLauncherOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsLauncherOpen(false)}
          />
          <aside ref={launcherRef} className="absolute top-0 left-0 h-full w-64 bg-teal-900 text-white shadow-lg p-4">
            <div className="leading-tight mb-3">
              <div className="text-sm font-bold text-white">RHD-CES</div>
              <div className="text-xs text-white/80">Cost Estimtation System</div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Dashboard</span>
              <button
                onClick={() => setIsLauncherOpen(false)}
                className="p-2 rounded hover:bg-teal-800"
                aria-label="Close dashboard"
                title="Close"
              >
                ×
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              <Link to="/products" className="px-3 py-2 rounded hover:bg-teal-800" onClick={() => setIsLauncherOpen(false)}>Items</Link>
              <Link to="/projects" className="px-3 py-2 rounded hover:bg-teal-800" onClick={() => setIsLauncherOpen(false)}>Projects</Link>
              
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

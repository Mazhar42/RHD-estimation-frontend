import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { User, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from "./hooks/useAuth.js";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/Auth/LoginPage";
import Products from "./pages/Products";
import Projects from "./pages/Projects";
import ProjectEstimations from "./pages/ProjectEstimations";
import EstimationDetail from "./pages/EstimationDetail";
import UserManagerPage from "./pages/Admin/UserManagerPage";
import NotificationsPage from "./pages/Admin/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";

function AppContent() {
  const { user, logout, hasRole } = useAuth();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const launcherRef = useRef(null);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef]);

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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/*"
        element={
          <ProtectedRoute>
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
                  {(hasRole("admin") || hasRole("superadmin")) && (
                    <Link
                      to="/admin/notifications"
                      className="text-xs px-3 py-1 rounded text-white hover:bg-teal-800 focus:outline-none focus:ring-1 focus:ring-white/60"
                      aria-label="Go to Notifications"
                    >
                      Notifications
                    </Link>
                  )}
                  {(hasRole("admin") || hasRole("superadmin")) && (
                    <Link
                      to="/admin/users"
                      className="text-xs px-3 py-1 rounded text-white hover:bg-teal-800 focus:outline-none focus:ring-1 focus:ring-white/60"
                      aria-label="Go to User Manager"
                    >
                      Users
                    </Link>
                  )}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-white hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                      aria-label="Profile menu"
                    >
                      {user?.username ? (
                        <span className="font-semibold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <User size={20} />
                      )}
                    </button>

                    {isProfileOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl py-2 text-gray-800 z-50 animate-in fade-in zoom-in-95 duration-200 border border-gray-100 ring-1 ring-black/5">
                        <div className="px-4 py-3 border-b border-gray-100 mb-1 mx-2 shadow-sm rounded-lg bg-gray-50/50">
                          <p className="font-semibold text-gray-900">{user?.username || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email || 'No email'}</p>
                        </div>
                        
                        <Link 
                          to="/profile" 
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 mx-2 rounded-lg group"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                            <User size={20} className="text-gray-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">Profile</span>
                            <span className="text-xs text-gray-500">View your profile</span>
                          </div>
                        </Link>

                        <button
                          onClick={() => {
                            logout();
                            setIsProfileOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left text-gray-700 mx-2 rounded-lg group"
                        >
                          <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                            <LogOut size={20} className="text-gray-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">Log Out</span>
                            <span className="text-xs text-gray-500">Sign out of your account</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
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
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route
                    path="/admin/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute requiredRole={["admin", "superadmin"]}>
                        <UserManagerPage />
                      </ProtectedRoute>
                    }
                  />
                  
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
                      {(hasRole("admin") || hasRole("superadmin")) && (
                        <Link to="/admin/users" className="px-3 py-2 rounded hover:bg-teal-800" onClick={() => setIsLauncherOpen(false)}>Users</Link>
                      )}
                      <Link to="/profile" className="px-3 py-2 rounded hover:bg-teal-800" onClick={() => setIsLauncherOpen(false)}>Profile</Link>
                      <button
                        onClick={() => { setIsLauncherOpen(false); logout(); }}
                        className="text-left px-3 py-2 rounded hover:bg-teal-800"
                      >
                        Logout
                      </button>
                    </nav>
                  </aside>
                </div>
              )}
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

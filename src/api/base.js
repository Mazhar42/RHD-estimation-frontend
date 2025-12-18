// Centralized API base resolver to avoid '/undefined' production paths
// Usage: import { API_BASE } from './base'

function resolveApiBase() {
  try {
    let raw = import.meta?.env?.VITE_API_BASE;
    // Support runtime-injected window env if present
    if (typeof window !== 'undefined') {
      const winEnv = window?.env?.VITE_API_BASE || window?.VITE_API_BASE;
      if (!raw && winEnv) raw = winEnv;
    }
    const s = String(raw || '').trim();
    // Treat empty, 'undefined', '/undefined', 'null' as invalid
    const invalid = !s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s === '/undefined' || s === '/null';
    if (invalid) return 'https://rhd-estimation-backend.onrender.com';
    // Require absolute http(s) URL; otherwise fallback
    if (!/^https?:\/\//i.test(s)) return 'https://rhd-estimation-backend.onrender.com';
    // Strip trailing slash for consistency
    return s.replace(/\/+$/, '');
  } catch {
    return 'https://rhd-estimation-backend.onrender.com';
  }
}

export const API_BASE = resolveApiBase();
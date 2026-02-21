// Centralized API base resolver to avoid '/undefined' production paths
// Usage: import { API_BASE } from './base'

function resolveApiBase() {
  return import.meta.env.VITE_API_BASE;
}

export const API_BASE = resolveApiBase();

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../api/auth";
import { apiClient } from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("authUser");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = useCallback(
    async (username, password) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authAPI.login(username, password);
        const { access_token, user: userData } = response.data;

        // Store token and user
        localStorage.setItem("authToken", access_token);
        localStorage.setItem("authUser", JSON.stringify(userData));

        setToken(access_token);
        setUser(userData);

        navigate("/projects");
        return userData;
      } catch (err) {
        const errorMessage = err.response?.data?.detail || "Login failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  const register = useCallback(
    async (username, email, password, fullName = "") => {
      setLoading(true);
      setError(null);
      try {
        const response = await authAPI.register(username, email, password, fullName);
        const { access_token, user: userData } = response.data;

        // Store token and user
        localStorage.setItem("authToken", access_token);
        localStorage.setItem("authUser", JSON.stringify(userData));

        setToken(access_token);
        setUser(userData);

        navigate("/projects");
        return userData;
      } catch (err) {
        const errorMessage =
          err.response?.data?.detail || "Registration failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login");
  }, [navigate]);

  const isAuthenticated = !!token && !!user;

  const hasRole = useCallback(
    (roleName) => {
      if (!user) return false;
      return user.roles?.some((role) => role.name === roleName) ?? false;
    },
    [user],
  );

  const hasPermission = useCallback(
    (permissionName) => {
      if (!user) return false;
      return (
        user.roles?.some((role) =>
          role.permissions?.some((perm) => perm.name === permissionName),
        ) ?? false
      );
    },
    [user],
  );

  const isSuperadmin = useCallback(() => {
    return hasRole("superadmin");
  }, [hasRole]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    error,
    setError,
    login,
    register,
    logout,
    hasRole,
    hasPermission,
    isSuperadmin,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

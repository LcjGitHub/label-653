import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  setToken,
  removeToken,
  setCurrentUser,
  getCurrentUser,
  removeCurrentUser,
  isAuthenticated as checkAuth
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth());
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const data = await apiLogin(credentials);
      setToken(data.token);
      setCurrentUser(data.user);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data) => {
    setLoading(true);
    try {
      const result = await apiRegister(data);
      setToken(result.token);
      setCurrentUser(result.user);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiLogout().catch(() => {});
    } finally {
      removeToken();
      removeCurrentUser();
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const data = await getMe();
      setCurrentUser(data.user);
      setUser(data.user);
      setIsAuthenticated(true);
    } catch {
      removeToken();
      removeCurrentUser();
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !user) {
      checkAuthStatus();
    }
  }, [isAuthenticated, user, checkAuthStatus]);

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

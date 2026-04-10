import { createContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/client';
import { AUTH_TOKEN_STORAGE_KEY } from '../config/app.config';

export const AuthContext = createContext(null);

const setAuthorizationHeader = (token) => {
  if (typeof token === 'string' && token.trim()) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
};

const clearStoredAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  setAuthorizationHeader(null);
};

const isTokenStringValid = (token) =>
  typeof token === 'string' &&
  token.trim() &&
  token.trim().split('.').length === 3;

const decodeTokenSafely = (token) => {
  if (!isTokenStringValid(token)) {
    return null;
  }

  try {
    const decoded = jwtDecode(token);
    if (!decoded?.exp || decoded.exp * 1000 <= Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyAuthToken = useCallback((nextToken) => {
    const decodedUser = decodeTokenSafely(nextToken);

    if (!decodedUser) {
      clearStoredAuth();
      setToken(null);
      setUser(null);
      return false;
    }

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    setAuthorizationHeader(nextToken);
    setToken(nextToken);
    setUser(decodedUser);
    return true;
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    applyAuthToken(storedToken);
    setLoading(false);
  }, [applyAuthToken]);

  const login = useCallback((nextToken) => applyAuthToken(nextToken), [applyAuthToken]);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: Boolean(token && user), role: user?.role ?? null, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

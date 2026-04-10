import api from './client';
import { AUTH_TOKEN_STORAGE_KEY } from '../config/app.config';

let requestInterceptorId = null;
let responseInterceptorId = null;

export const setupApiInterceptors = (logout) => {
  if (requestInterceptorId !== null) {
    api.interceptors.request.eject(requestInterceptorId);
  }

  if (responseInterceptorId !== null) {
    api.interceptors.response.eject(responseInterceptorId);
  }

  requestInterceptorId = api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      config.headers = config.headers ?? {};
      if (typeof token === 'string' && token.trim()) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  responseInterceptorId = api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
      }

      return Promise.reject(error);
    }
  );

  return () => {
    if (requestInterceptorId !== null) {
      api.interceptors.request.eject(requestInterceptorId);
      requestInterceptorId = null;
    }

    if (responseInterceptorId !== null) {
      api.interceptors.response.eject(responseInterceptorId);
      responseInterceptorId = null;
    }
  };
};

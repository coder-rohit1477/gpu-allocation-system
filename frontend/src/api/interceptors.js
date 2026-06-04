import api from './client';
import { AUTH_TOKEN_STORAGE_KEY } from '../config/app.config';

let requestInterceptorId  = null;
let responseInterceptorId = null;
let isRefreshing          = false;
let failedQueue           = [];   // requests that came in while refresh was in-flight

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else       prom.resolve(token);
  });
  failedQueue = [];
};

export const setupApiInterceptors = (logout) => {
  // ── Eject any previous interceptors before re-registering ──
  if (requestInterceptorId  !== null) api.interceptors.request.eject(requestInterceptorId);
  if (responseInterceptorId !== null) api.interceptors.response.eject(responseInterceptorId);

  // ── Request: attach Bearer token ──
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

  // ── Response: silent token refresh on 401 ──
  responseInterceptorId = api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If it's a 401 AND we haven't already retried this request
      if (error.response?.status === 401 && !originalRequest._retry) {

        // If the 401 is on the refresh endpoint itself → hard logout
        if (originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/login')) {
          logout();
          return Promise.reject(error);
        }

        if (isRefreshing) {
          // Another refresh is in-flight — queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }).catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing            = true;

        try {
          // The refresh token lives in an httpOnly cookie — no JS access needed
          const { data } = await api.post('/v1/auth/refresh');
          const newToken  = data.token;

          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

          processQueue(null, newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          logout();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return () => {
    if (requestInterceptorId  !== null) {
      api.interceptors.request.eject(requestInterceptorId);
      requestInterceptorId = null;
    }
    if (responseInterceptorId !== null) {
      api.interceptors.response.eject(responseInterceptorId);
      responseInterceptorId = null;
    }
  };
};

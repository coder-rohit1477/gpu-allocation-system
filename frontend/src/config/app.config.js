const normalizeValue = (value, fallback) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || fallback;
};

const normalizeApiBasePath = (value, fallback) => {
  const normalizedValue = normalizeValue(value, fallback);
  return normalizedValue.replace(/\/v1\/?$/, '');
};

export const API_BASE_PATH = normalizeApiBasePath(import.meta.env.VITE_API_BASE_PATH, '/api');
export const AUTH_TOKEN_STORAGE_KEY = 'token';

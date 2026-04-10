const normalizeValue = (value, fallback) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || fallback;
};

export const API_BASE_PATH = normalizeValue(import.meta.env.VITE_API_BASE_PATH, '/api');
export const AUTH_TOKEN_STORAGE_KEY = 'token';

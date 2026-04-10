import api from '../api/client';

const validateAuthResponse = (label, response) => {
  const token = response?.data?.token;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(`${label} did not return a valid token string.`);
  }

  return response.data;
};

const login = async ({ username, password }) => {
  const response = await api.post('/v1/auth/login', { username, password });
  return validateAuthResponse('login', response);
};

const signup = async ({ username, password, role }) => {
  const response = await api.post('/v1/auth/signup', { username, password, role });
  return validateAuthResponse('signup', response);
};

export default { login, signup };

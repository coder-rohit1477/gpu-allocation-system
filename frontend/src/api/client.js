import axios from 'axios';
import { API_BASE_PATH } from '../config/app.config';

const api = axios.create({
  baseURL: API_BASE_PATH,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

export default api;

import axios from 'axios';
import { loadActiveTenantNamespace } from './utils/branding';

const resolveApiBaseUrl = () => {
  // Priorizar variables con prefijo REACT_APP_ (embed en build)
  const rawBase =
    process.env.REACT_APP_API_URL ||
    process.env.EXTERNAL_API_URL ||
    'https://pmshotel-production.up.railway.app';

  const trimmedBase = String(rawBase).replace(/\/$/, '');
  if (trimmedBase.endsWith('/api')) {
    return trimmedBase;
  }
  return `${trimmedBase}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  // Activa withCredentials solo si lo necesitas (cookies de sesión)
  withCredentials: true
});

export default apiClient;

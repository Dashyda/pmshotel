// Archivo: frontend/src/services/api.js
import axios from 'axios';
import { loadActiveTenantNamespace } from '../utils/branding'; // <-- ruta corregida

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
  // IMPORTANTE: si tu backend usa cookies para sesión, activa withCredentials
  // y asegúrate que backend CORS tiene credentials: true y devuelve Origin exacto.
  withCredentials: true
});

// Interceptor para agregar token de autenticación (sigue igual)
apiClient.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    const token = localStorage.getItem('pms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeNamespace = loadActiveTenantNamespace();
    if (activeNamespace) {
      config.headers['X-Tenant-Namespace'] = activeNamespace;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ... resto del archivo (interceptor de respuesta, servicios authAPI, dashboardAPI, etc.)
export default apiClient;
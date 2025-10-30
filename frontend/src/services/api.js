import axios from 'axios';
import { loadActiveTenantNamespace } from '../utils/branding';

// Resolver base URL (priorizar REACT_APP_ en build)
const resolveApiBaseUrl = () => {
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
  withCredentials: true // activar solo si usas cookies/sesión
});

// Interceptor request: agregar token y namespace
apiClient.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('pms_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeNamespace = loadActiveTenantNamespace?.();
    if (activeNamespace) {
      config.headers['X-Tenant-Namespace'] = activeNamespace;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper para normalizar errores
export const handleAPIError = (error) => {
  if (!error) return { success: false, message: 'Error desconocido' };
  if (error.response) {
    // Respuesta del servidor
    const data = error.response.data;
    const message = data?.message || data?.error || error.response.statusText || 'Error en respuesta del servidor';
    return { success: false, message, status: error.response.status, data };
  }
  // Error de red o config
  return { success: false, message: error.message || 'Error de red' };
};

// Exportar APIs usadas por los componentes
export const dashboardAPI = {
  getStats: async () => {
    try {
      const res = await apiClient.get('/dashboard/stats');
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  }
};

export const colaboradoresAPI = {
  list: async (params = {}) => {
    try {
      const res = await apiClient.get('/colaboradores', { params });
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  },
  get: async (id) => {
    try {
      const res = await apiClient.get(`/colaboradores/${id}`);
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  },
  create: async (payload) => {
    try {
      const res = await apiClient.post('/colaboradores', payload);
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  }
};

// API de autenticación (ejemplos comunes)
export const authAPI = {
  login: async (credentials) => {
    try {
      const res = await apiClient.post('/auth/login', credentials);
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  },
  verify: async () => {
    try {
      const res = await apiClient.get('/auth/verify');
      return { success: true, data: res.data };
    } catch (err) {
      return handleAPIError(err);
    }
  }
};

// Export por defecto del cliente axios (si alguna parte del código lo importa)
export default apiClient;
import axios from 'axios';
import { loadActiveTenantNamespace } from '../utils/branding';

// Configuración base de Axios
const resolveApiBaseUrl = () => {
  const rawBase = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const trimmedBase = rawBase.replace(/\/$/, '');
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
  }
});

// Interceptor para agregar token de autenticación
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

// Interceptor para manejar respuestas y errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido, limpiar estado local
      localStorage.removeItem('pms_token');
      localStorage.removeItem('pms_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Servicios de API

// Autenticación
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
  verify: () => apiClient.get('/auth/verify'),
  verifyToken: () => apiClient.get('/auth/verify'), // Añadido para App.js
  refresh: () => apiClient.post('/auth/refresh')
};

// Dashboard
export const dashboardAPI = {
  getOverview: () => apiClient.get('/dashboard/overview'), // Añadido para Dashboard.js
  getStats: () => apiClient.get('/dashboard/stats'),
  getOcupacionSemanal: () => apiClient.get('/dashboard/ocupacion-semanal'),
  getIngresosMensuales: () => apiClient.get('/dashboard/ingresos-mensuales'),
  getMovimientosHoy: () => apiClient.get('/dashboard/movimientos-hoy'),
  getAlertas: () => apiClient.get('/dashboard/alertas'),
  getResumenUnidades: () => apiClient.get('/dashboard/resumen-unidades'),
  getWidget: (widget) => apiClient.get(`/dashboard/widget/${widget}`)
};

// Ocupación
export const ocupacionAPI = {
  getReservas: (params) => apiClient.get('/ocupacion/reservas', { params }),
  createReserva: (data) => apiClient.post('/ocupacion/reservas', data),
  checkin: (id, data) => apiClient.put(`/ocupacion/reservas/${id}/checkin`, data),
  checkout: (id, data) => apiClient.put(`/ocupacion/reservas/${id}/checkout`, data),
  getCalendario: (params) => apiClient.get('/ocupacion/calendario', { params })
};

// Alojamientos
export const alojamientosAPI = {
  getPalaces: () => apiClient.get('/alojamientos/palaces'),
  createPalace: (payload) => apiClient.post('/alojamientos/palaces', payload),
  updatePalace: (palaceId, payload) => apiClient.put(`/alojamientos/palaces/${palaceId}`, payload),
  deletePalace: (palaceId) => apiClient.delete(`/alojamientos/palaces/${palaceId}`),
  updateRoom: (palaceId, roomId, payload) => apiClient.patch(`/alojamientos/palaces/${palaceId}/rooms/${roomId}`, payload)
};

// Colaboradores
export const colaboradoresAPI = {
  getColaboradores: (params) => apiClient.get('/colaboradores', { params }),
  createColaborador: (data) => apiClient.post('/colaboradores', data),
  updateColaborador: (id, data) => apiClient.put(`/colaboradores/${id}`, data),
  deleteColaborador: (id) => apiClient.delete(`/colaboradores/${id}`),
  getTurnos: () => apiClient.get('/colaboradores/turnos'),
  retire: (id, payload) => apiClient.post(`/colaboradores/${id}/retire`, payload),
  getMovimientos: (params) => apiClient.get('/colaboradores/movimientos', { params }),
  clearMovimientos: () => apiClient.delete('/colaboradores/movimientos')
};

// Huéspedes
export const huespedesAPI = {
  getHuespedes: (params) => apiClient.get('/huespedes', { params }),
  createHuesped: (data) => apiClient.post('/huespedes', data),
  updateHuesped: (id, data) => apiClient.put(`/huespedes/${id}`, data),
  deleteHuesped: (id) => apiClient.delete(`/huespedes/${id}`),
  getHuesped: (id) => apiClient.get(`/huespedes/${id}`)
};

// Administración
export const adminAPI = {
  getUsuarios: () => apiClient.get('/admin/usuarios'),
  getRoles: () => apiClient.get('/admin/roles'),
  getAuditoria: (params) => apiClient.get('/admin/auditoria', { params }),
  createUsuario: (data) => apiClient.post('/admin/usuarios', data),
  updateUsuario: (id, data) => apiClient.put(`/admin/usuarios/${id}`, data),
  deleteUsuario: (id) => apiClient.delete(`/admin/usuarios/${id}`),
  registerTenant: (data) => apiClient.post('/admin/tenants', data),
  removeTenant: (namespace) => apiClient.delete(`/admin/tenants/${namespace}`)
};

// Utilidades
export const utilsAPI = {
  uploadFile: (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return apiClient.post('/utils/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  exportData: (type, params) => apiClient.get(`/utils/export/${type}`, {
    params,
    responseType: 'blob'
  }),
  
  getHealth: () => axios.get(`${API_BASE_URL}/../health`)
};

// Función helper para manejar errores de la API
export const handleAPIError = (error) => {
  if (error.response) {
    // El servidor respondió con un código de error
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return `Error de validación: ${data.message || 'Datos inválidos'}`;
      case 401:
        return 'No autorizado. Por favor inicia sesión nuevamente.';
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'El recurso solicitado no fue encontrado.';
      case 409:
        return `Conflicto: ${data.message || 'Ya existe un registro con estos datos'}`;
      case 429:
        return 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.';
      case 500:
        return 'Error del servidor. Por favor contacta al administrador.';
      default:
        return data.message || 'Ocurrió un error inesperado.';
    }
  } else if (error.request) {
    // No se recibió respuesta del servidor
    return 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
  } else {
    // Error en la configuración de la solicitud
    return `Error: ${error.message}`;
  }
};

// Función para verificar si el usuario está autenticado
export const isAuthenticated = () => {
  const token = localStorage.getItem('pms_token');
  return !!token;
};

// Función para obtener datos del usuario actual
export const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('pms_user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    localStorage.removeItem('pms_user');
    return null;
  }
};

// Función para guardar token y datos de usuario
export const setAuthData = (token, user) => {
  localStorage.setItem('pms_token', token);
  localStorage.setItem('pms_user', JSON.stringify(user));
};

// Función para limpiar datos de autenticación
export const clearAuthData = () => {
  localStorage.removeItem('pms_token');
  localStorage.removeItem('pms_user');
};

export default apiClient;
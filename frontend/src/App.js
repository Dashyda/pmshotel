import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  CircularProgress,
  Box,
  Alert
} from '@mui/material';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import NavigationLayout from './components/NavigationLayout';
import Disponibilidad from './modules/Disponibilidad';
import Alojamientos from './modules/Alojamientos';
import Colaboradores from './modules/Colaboradores';
import MTTOReportes from './modules/MTTOReportes';
import MTTOReportar from './modules/MTTOReportar';
import Administrador from './modules/Administrador';
import Ayuda from './modules/Ayuda';
import { authAPI, adminAPI } from './services/api';
import { saveActiveTenantNamespace, clearActiveTenantNamespace, DEFAULT_TENANT, applyTenantBranding, loadTenants } from './utils/branding';

// Crear tema personalizado
const theme = createTheme({
  palette: {
    primary: {
      main: '#4f46e5',
      light: '#7c3aed',
      dark: '#3730a3',
    },
    secondary: {
      main: '#059669',
      light: '#34d399',
      dark: '#047857',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    success: {
      main: '#059669',
      light: '#34d399',
      dark: '#047857',
    },
    warning: {
      main: '#d97706',
      light: '#fbbf24',
      dark: '#92400e',
    },
    error: {
      main: '#dc2626',
      light: '#f87171',
      dark: '#991b1b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const OVERRIDES_STORAGE_KEY = 'pms_user_overrides';

  const resolveOverrideKey = (userData) => {
    if (!userData) {
      return 'default';
    }

    if (userData.id !== undefined && userData.id !== null) {
      return `id:${userData.id}`;
    }

    if (userData.email) {
      return `email:${String(userData.email).toLowerCase()}`;
    }

    if (userData.username) {
      return `username:${String(userData.username).toLowerCase()}`;
    }

    return 'default';
  };

  const loadUserOverrides = () => {
    try {
      const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (overrideError) {
      console.warn('No se pudieron cargar las personalizaciones del usuario.', overrideError);
      localStorage.removeItem(OVERRIDES_STORAGE_KEY);
      return {};
    }
  };

  const applyUserOverrides = (baseUser) => {
    if (!baseUser) {
      return baseUser;
    }

    const overrides = loadUserOverrides();
    const key = resolveOverrideKey(baseUser);
    const entry = overrides[key];

    if (!entry) {
      return baseUser;
    }

    return {
      ...baseUser,
      ...(entry.profile || {})
    };
  };

  const persistUserOverrides = (baseUser, updates, passwordUpdated) => {
    if (!baseUser || (!updates && !passwordUpdated)) {
      return;
    }

    const overrides = loadUserOverrides();
    const key = resolveOverrideKey(baseUser);
    const existing = overrides[key] || {};

    overrides[key] = {
      ...existing,
      ...(updates
        ? {
            profile: {
              ...(existing.profile || {}),
              ...updates
            }
          }
        : {}),
      ...(passwordUpdated
        ? {
            passwordHint: 'updated',
            passwordUpdatedAt: new Date().toISOString()
          }
        : {})
    };

    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  };

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('pms_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const { data } = await authAPI.verifyToken();
      if (data) {
        const userWithOverrides = applyUserOverrides(data);
        if (userWithOverrides) {
          localStorage.setItem('pms_user', JSON.stringify(userWithOverrides));
        }
        const resolvedNamespace = userWithOverrides?.namespace || data?.namespace || DEFAULT_TENANT;
        saveActiveTenantNamespace(resolvedNamespace);
        applyTenantBranding(resolvedNamespace);
        setUser(userWithOverrides);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('pms_token');
        localStorage.removeItem('pms_user');
        clearActiveTenantNamespace();
        applyTenantBranding(DEFAULT_TENANT);
        setIsAuthenticated(false);
      }
    } catch (error) {
      localStorage.removeItem('pms_token');
      localStorage.removeItem('pms_user');
      clearActiveTenantNamespace();
      applyTenantBranding(DEFAULT_TENANT);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (credentials) => {
    try {
      setError(null);
      setLoading(true);
      
      const { data } = await authAPI.login(credentials);
      const { token, user } = data;

      if (!token || !user) {
        throw new Error('No se recibió el token de autenticación');
      }

      localStorage.setItem('pms_token', token);
      const userWithOverrides = applyUserOverrides(user);
      if (userWithOverrides) {
        localStorage.setItem('pms_user', JSON.stringify(userWithOverrides));
      }
      const resolvedNamespace = userWithOverrides?.namespace || user?.namespace || DEFAULT_TENANT;
      saveActiveTenantNamespace(resolvedNamespace);
      applyTenantBranding(resolvedNamespace);
      setUser(userWithOverrides);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error al iniciar sesión';

      if (error.response?.status === 401 && credentials?.email && credentials?.password) {
        const emailInput = String(credentials.email).trim().toLowerCase();
        const tenants = loadTenants();
        const matchedTenant = tenants.find((tenant) => {
          const tenantEmail = (tenant.contactEmail || '').trim().toLowerCase();
          const tenantNamespace = (tenant.namespace || '').trim().toLowerCase();
          return tenantEmail === emailInput || tenantNamespace === emailInput;
        });

        if (matchedTenant && matchedTenant.password === credentials.password) {
          try {
            await adminAPI.registerTenant({
              namespace: matchedTenant.namespace,
              hotelName: matchedTenant.hotelName,
              contactName: matchedTenant.contactName,
              contactEmail: matchedTenant.contactEmail,
              tagline: matchedTenant.tagline,
              password: matchedTenant.password
            });

            const retry = await authAPI.login(credentials);
            const { token, user } = retry.data || {};

            if (token && user) {
              localStorage.setItem('pms_token', token);
              const userWithOverrides = applyUserOverrides(user);
              if (userWithOverrides) {
                localStorage.setItem('pms_user', JSON.stringify(userWithOverrides));
              }
              const resolvedNamespace = userWithOverrides?.namespace || user?.namespace || DEFAULT_TENANT;
              saveActiveTenantNamespace(resolvedNamespace);
              applyTenantBranding(resolvedNamespace);
              setUser(userWithOverrides);
              setIsAuthenticated(true);
              return { success: true };
            }
          } catch (syncError) {
            console.warn('No se pudo sincronizar el usuario con el servidor demo.', syncError);
          }
        }
      }

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pms_token');
    localStorage.removeItem('pms_user');
    clearActiveTenantNamespace();
    applyTenantBranding(DEFAULT_TENANT);
    setUser(null);
    setIsAuthenticated(false);
  };

  const handleUserUpdate = (updates = {}, options = {}) => {
    setUser((previousUser) => {
      if (!previousUser) {
        return previousUser;
      }

      const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value === undefined) {
          return acc;
        }
        if (typeof value === 'string') {
          acc[key] = value.trim();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});

      const nextUser = {
        ...previousUser,
        ...sanitizedUpdates
      };

      persistUserOverrides(previousUser, sanitizedUpdates, options?.passwordUpdated);
      localStorage.setItem('pms_user', JSON.stringify(nextUser));

      return nextUser;
    });
  };

  if (loading && !isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          flexDirection="column"
        >
          <CircularProgress size={60} />
          <Box mt={2}>
            Verificando autenticación...
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {!isAuthenticated ? (
          <Box>
            {error && (
              <Alert severity="error" sx={{ m: 2 }}>
                {error}
              </Alert>
            )}
            <Login onLogin={handleLogin} loading={loading} />
          </Box>
        ) : (
          <NavigationLayout user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/disponibilidad" element={<Disponibilidad />} />
              <Route path="/ocupacion" element={<Navigate to="/disponibilidad" replace />} />
              <Route path="/alojamientos" element={<Alojamientos />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/mtto-reportar" element={<MTTOReportar />} />
              <Route path="/mtto-reportes" element={<MTTOReportes />} />
              <Route path="/administrador" element={<Administrador />} />
              <Route path="/ayuda" element={<Ayuda />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </NavigationLayout>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
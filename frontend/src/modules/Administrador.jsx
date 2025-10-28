import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import DomainAddIcon from '@mui/icons-material/DomainAdd';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  DEFAULT_BRANDING,
  DEFAULT_TENANT,
  loadBranding,
  loadTenants,
  saveBranding,
  saveTenants,
  createTenantRecord,
  subscribeBranding,
  subscribeTenants,
  loadActiveTenantNamespace,
  saveActiveTenantNamespace,
  subscribeActiveTenantNamespace,
  applyTenantBranding,
  loadDefaultBranding,
  saveDefaultBranding
} from '../utils/branding';
import { adminAPI, getCurrentUser, handleAPIError } from '../services/api';

const Administrador = () => {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isSuperAdmin = (currentUser?.rol || '').toLowerCase() === 'super_admin';

  const [activeNamespace, setActiveNamespace] = useState(() => loadActiveTenantNamespace());
  const [brandForm, setBrandForm] = useState(() => loadBranding().branding);
  const [tenants, setTenants] = useState(() => loadTenants());
  const [tenantForm, setTenantForm] = useState({
    hotelName: '',
    tagline: '',
    contactName: '',
    contactEmail: '',
    password: ''
  });
  const [status, setStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribeBranding = subscribeBranding((next) => {
      setBrandForm((prev) => ({ ...prev, ...next }));
    });
    const unsubscribeTenants = subscribeTenants((next) => {
      setTenants(next);
    });
    const unsubscribeActiveTenant = subscribeActiveTenantNamespace?.((namespace) => {
      setActiveNamespace(namespace);
    });
    return () => {
      unsubscribeBranding?.();
      unsubscribeTenants?.();
      unsubscribeActiveTenant?.();
    };
  }, []);

  const selectedTenant = useMemo(() => {
    return tenants.find((tenant) => tenant.namespace === activeNamespace) || null;
  }, [tenants, activeNamespace]);

  const activeTenantLabel = useMemo(() => {
    if (selectedTenant) {
      const name = selectedTenant.hotelName || DEFAULT_BRANDING.hotelName;
      const tagline = selectedTenant.tagline ? ` • ${selectedTenant.tagline}` : '';
      return `${name}${tagline}`;
    }
    const fallbackName = brandForm.hotelName || DEFAULT_BRANDING.hotelName;
    const fallbackTagline = brandForm.tagline ? ` • ${brandForm.tagline}` : '';
    return `${fallbackName}${fallbackTagline}`;
  }, [selectedTenant, brandForm.hotelName, brandForm.tagline]);

  useEffect(() => {
    if (selectedTenant) {
      setBrandForm({
        hotelName: selectedTenant.hotelName || DEFAULT_BRANDING.hotelName,
        tagline: selectedTenant.tagline || ''
      });
    } else {
      const { branding } = loadBranding();
      setBrandForm({
        hotelName: branding.hotelName || DEFAULT_BRANDING.hotelName,
        tagline: branding.tagline || DEFAULT_BRANDING.tagline
      });
    }
  }, [selectedTenant, activeNamespace]);

  const handleBrandInputChange = (field) => (event) => {
    setBrandForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleDeleteTenant = async (tenant) => {
    if (!isSuperAdmin || !tenant) {
      return;
    }
    const confirmed = window.confirm(`¿Eliminar el usuario ${tenant.hotelName}? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }
    try {
      await adminAPI.removeTenant(tenant.namespace);
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode !== 404) {
        console.error('No se pudo eliminar el tenant en el servidor', error);
        const message = typeof handleAPIError === 'function'
          ? handleAPIError(error)
          : 'No se pudo eliminar el usuario en el servidor.';
        setStatus({ type: 'error', message });
        return;
      }
      console.warn('Tenant no encontrado en el servidor; continuando con eliminación local.', tenant.namespace);
    }
    const updated = tenants.filter((item) => item.id !== tenant.id);
    saveTenants(updated);
    setTenants(updated);

    if (tenant.namespace === activeNamespace) {
      saveActiveTenantNamespace(DEFAULT_TENANT);
      applyTenantBranding(DEFAULT_TENANT);
      const defaultBranding = loadDefaultBranding();
      setBrandForm(defaultBranding);
      setStatus({ type: 'success', message: `El usuario ${tenant.hotelName} fue eliminado. Has vuelto al PMS principal.` });
    } else {
      setStatus({ type: 'success', message: `El usuario ${tenant.hotelName} fue eliminado.` });
    }
  };

  const handleSubmitBrand = (event) => {
    event.preventDefault();
    if (!isSuperAdmin) {
      return;
    }
    const payload = {
      hotelName: brandForm.hotelName?.trim() || DEFAULT_BRANDING.hotelName,
      tagline: brandForm.tagline?.trim() || DEFAULT_BRANDING.tagline
    };
    if (!selectedTenant) {
      saveDefaultBranding(payload);
    }
    saveBranding(payload);
    if (selectedTenant) {
      const updated = tenants.map((tenant) =>
        tenant.id === selectedTenant.id
          ? { ...tenant, hotelName: payload.hotelName, tagline: payload.tagline }
          : tenant
      );
      saveTenants(updated);
      setTenants(updated);
    }
    setStatus({ type: 'success', message: 'Identidad del sistema actualizada correctamente.' });
  };

  const handleTenantFieldChange = (field) => (event) => {
    setTenantForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleCreateTenant = async (event) => {
    event.preventDefault();
    if (!isSuperAdmin) {
      return;
    }
    const trimmedHotelName = tenantForm.hotelName.trim();
    const trimmedEmail = tenantForm.contactEmail.trim();
    const trimmedPassword = tenantForm.password.trim();

    if (!trimmedHotelName) {
      setStatus({ type: 'error', message: 'Ingresa el nombre comercial del hotel.' });
      return;
    }
    if (!trimmedEmail) {
      setStatus({ type: 'error', message: 'Proporciona un correo de contacto para el usuario administrador.' });
      return;
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setStatus({ type: 'error', message: 'Define una contraseña de al menos 6 caracteres.' });
      return;
    }

  setStatus(null);

  const record = createTenantRecord({ ...tenantForm, hotelName: trimmedHotelName, contactEmail: trimmedEmail, password: trimmedPassword });

    try {
      await adminAPI.registerTenant({
        namespace: record.namespace,
        hotelName: record.hotelName,
        contactName: record.contactName,
        contactEmail: record.contactEmail,
        tagline: record.tagline,
        password: trimmedPassword
      });
    } catch (error) {
      console.error('No se pudo registrar el tenant en el servidor', error);
      const message = typeof handleAPIError === 'function'
        ? handleAPIError(error)
        : 'No se pudo registrar el usuario en el servidor.';
      setStatus({ type: 'error', message });
      return;
    }

    const nextTenants = [...tenants, record];
    saveTenants(nextTenants);
    setTenants(nextTenants);
    setTenantForm({ hotelName: '', tagline: '', contactName: '', contactEmail: '', password: '' });
    saveActiveTenantNamespace(record.namespace);
    applyTenantBranding(record.namespace);
    setStatus({ type: 'success', message: 'Nuevo usuario/tenant creado con contraseña asignada. Comparte su namespace para configurar su entorno dedicado.' });
  };

  const handleSwitchTenant = (tenant) => {
    if (!isSuperAdmin || !tenant) {
      return;
    }
    saveActiveTenantNamespace(tenant.namespace);
    applyTenantBranding(tenant.namespace);
    setStatus({ type: 'success', message: `Visualizando el PMS de ${tenant.hotelName}.` });
  };

  const handleResetBrand = () => {
    if (!isSuperAdmin) {
      return;
    }
    setBrandForm(DEFAULT_BRANDING);
    saveDefaultBranding(DEFAULT_BRANDING);
    saveBranding(DEFAULT_BRANDING);
    if (selectedTenant) {
      const updated = tenants.map((tenant) =>
        tenant.id === selectedTenant.id
          ? { ...tenant, hotelName: DEFAULT_BRANDING.hotelName, tagline: DEFAULT_BRANDING.tagline }
          : tenant
      );
      saveTenants(updated);
      setTenants(updated);
    }
    setStatus({ type: 'success', message: 'Marca restablecida a los valores predeterminados.' });
  };

  const handleReturnToDefault = () => {
    if (!isSuperAdmin) {
      return;
    }
    saveActiveTenantNamespace(DEFAULT_TENANT);
    applyTenantBranding(DEFAULT_TENANT);
    setStatus({ type: 'success', message: 'Has vuelto al PMS principal.' });
  };

  const handleCopyNamespace = async (namespace) => {
    if (typeof navigator?.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(namespace);
        setStatus({ type: 'success', message: 'Namespace copiado al portapapeles.' });
      } catch (error) {
        setStatus({ type: 'error', message: 'No se pudo copiar el namespace automáticamente.' });
      }
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Administración del Sistema
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Gestiona la identidad del PMS y crea accesos dedicados para cada hotel operado en la plataforma.
      </Typography>

      {status ? (
        <Alert
          severity={status.type === 'error' ? 'error' : 'success'}
          onClose={() => setStatus(null)}
          sx={{ mb: 3 }}
        >
          {status.message}
        </Alert>
      ) : null}

      {!isSuperAdmin ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Solo el super administrador puede editar la marca del sistema y crear nuevas cuentas de hotel.
        </Alert>
      ) : null}

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 3 }}
          >
            <Chip
              color="primary"
              variant="outlined"
              label={`Visualizando: ${activeTenantLabel}`}
              sx={{ fontWeight: 600 }}
            />
            {isSuperAdmin ? (
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={handleReturnToDefault}
                disabled={activeNamespace === DEFAULT_TENANT}
              >
                Volver al PMS principal
              </Button>
            ) : null}
          </Stack>
          {isSuperAdmin ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Usa el botón «Entrar» en la tabla para cambiar de PMS y personalizar los otros paneles sin salir de tu sesión.
            </Typography>
          ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper component="form" onSubmit={handleSubmitBrand} sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <WorkspacePremiumIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Identidad del PMS
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Personaliza el nombre visible en el menú lateral y la portada de inicio de sesión.
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Nombre comercial"
                value={brandForm.hotelName}
                onChange={handleBrandInputChange('hotelName')}
                disabled={!isSuperAdmin}
                required
              />
              <TextField
                label="Tagline / Ubicación"
                value={brandForm.tagline}
                onChange={handleBrandInputChange('tagline')}
                disabled={!isSuperAdmin}
              />
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  type="button"
                  variant="text"
                  disabled={!isSuperAdmin}
                  onClick={handleResetBrand}
                >
                  Restablecer valores
                </Button>
                <Button type="submit" variant="contained" disabled={!isSuperAdmin}>
                  Guardar cambios
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        {isSuperAdmin ? (
          <Grid item xs={12} md={6}>
            <Paper component="form" onSubmit={handleCreateTenant} sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <DomainAddIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Nuevo hotel / usuario del panel
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Al crear un usuario se genera un namespace único. Usa ese identificador para aislar la información del hotel en tus integraciones.
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Nombre del hotel"
                  value={tenantForm.hotelName}
                  onChange={handleTenantFieldChange('hotelName')}
                  disabled={!isSuperAdmin}
                  required
                />
                <TextField
                  label="Tagline / Ciudad"
                  value={tenantForm.tagline}
                  onChange={handleTenantFieldChange('tagline')}
                  disabled={!isSuperAdmin}
                />
                <TextField
                  label="Nombre del responsable"
                  value={tenantForm.contactName}
                  onChange={handleTenantFieldChange('contactName')}
                  disabled={!isSuperAdmin}
                />
                <TextField
                  label="Correo administrador"
                  type="email"
                  value={tenantForm.contactEmail}
                  onChange={handleTenantFieldChange('contactEmail')}
                  disabled={!isSuperAdmin}
                  required
                />
                <TextField
                  label="Contraseña de acceso"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={tenantForm.password}
                  onChange={handleTenantFieldChange('password')}
                  disabled={!isSuperAdmin}
                  required
                  inputProps={{ minLength: 6 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Mostrar u ocultar contraseña"
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Button type="submit" variant="contained" disabled={!isSuperAdmin}>
                  Registrar usuario
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ) : null}
      </Grid>

      {isSuperAdmin ? (
        <>
          <Divider sx={{ my: 4 }} />

          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Diversity3Icon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Usuarios registrados
              </Typography>
            </Stack>
            {tenants.length === 0 ? (
              <Alert severity="info">Aún no se han creado usuarios dedicados. Cada registro contendrá su namespace aislado.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Hotel</TableCell>
                    <TableCell>Contacto</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Namespace</TableCell>
                    <TableCell>Creado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id} hover>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {tenant.hotelName}
                          </Typography>
                          {tenant.tagline ? (
                            <Typography variant="caption" color="text.secondary">
                              {tenant.tagline}
                            </Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {tenant.contactName ? tenant.contactName : <Typography variant="caption" color="text.secondary">Sin asignar</Typography>}
                      </TableCell>
                      <TableCell>{tenant.contactEmail}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={tenant.namespace} variant="outlined" size="small" />
                          <Tooltip title="Copiar namespace">
                            <span>
                              <IconButton size="small" onClick={() => handleCopyNamespace(tenant.namespace)}>
                                <ContentCopyIcon fontSize="inherit" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(tenant.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Button
                            size="small"
                            variant={tenant.namespace === activeNamespace ? 'contained' : 'outlined'}
                            color={tenant.namespace === activeNamespace ? 'primary' : 'inherit'}
                            onClick={() => handleSwitchTenant(tenant)}
                            disabled={!isSuperAdmin || tenant.namespace === activeNamespace}
                          >
                            {tenant.namespace === activeNamespace ? 'Visualizando' : 'Entrar'}
                          </Button>
                          <Tooltip title="Eliminar usuario">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteTenant(tenant)}
                                disabled={!isSuperAdmin}
                              >
                                <DeleteForeverIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      ) : null}
    </Box>
  );
};

export default Administrador;

import React, { useEffect, useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Chip,
  Snackbar,
  Alert,
  TextField
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Hotel as HotelIcon,
  EventAvailable as EventAvailableIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Help as HelpIcon,
  Group as GroupIcon,
  Handyman as HandymanIcon,
  NoteAdd as NoteAddIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadBranding, subscribeBranding, DEFAULT_BRANDING } from '../utils/branding';

const drawerWidth = 280;

const NavigationLayout = ({ children, user, onLogout, onUserUpdate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  const [settingsForm, setSettingsForm] = useState({
    nombre: user?.nombre || '',
    apellidos: user?.apellidos || '',
    telefono: user?.telefono || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const { branding: initialBranding } = loadBranding();
    setBranding(initialBranding);

    const unsubscribe = subscribeBranding((nextBranding) => {
      setBranding((prev) => ({
        ...prev,
        ...nextBranding
      }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setSettingsForm((previous) => ({
      ...previous,
      nombre: user?.nombre || '',
      apellidos: user?.apellidos || '',
      telefono: user?.telefono || '',
      email: user?.email || ''
    }));
  }, [user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    if (onLogout) {
      onLogout();
    }
  };

  const handleSettingsFieldChange = (field) => (event) => {
    const value = event.target.value;
    setSettingsForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
  };

  const formatDateTime = (value) => {
    if (!value) {
      return 'No registrado';
    }
    try {
      return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value));
    } catch (error) {
      console.warn('No se pudo formatear la fecha proporcionada', error);
      return value;
    }
  };

  const handleSettingsSubmit = (event) => {
    event.preventDefault();

    if (settingsForm.password && settingsForm.password !== settingsForm.confirmPassword) {
      setSettingsError('Las contraseñas no coinciden.');
      return;
    }

    const trimmedName = (settingsForm.nombre || '').trim();
    const trimmedLastName = (settingsForm.apellidos || '').trim();
    const trimmedPhone = (settingsForm.telefono || '').trim();

    const updates = {};
    if (trimmedName && trimmedName !== user?.nombre) {
      updates.nombre = trimmedName;
    }
    if (trimmedLastName !== user?.apellidos) {
      updates.apellidos = trimmedLastName;
    }
    if (trimmedPhone !== (user?.telefono || '')) {
      updates.telefono = trimmedPhone;
    }

    if (Object.keys(updates).length === 0 && !settingsForm.password) {
      setSettingsError('No hay cambios para guardar.');
      return;
    }

    if (onUserUpdate && Object.keys(updates).length > 0) {
      onUserUpdate(updates, { passwordUpdated: Boolean(settingsForm.password) });
    } else if (onUserUpdate && settingsForm.password) {
      onUserUpdate({}, { passwordUpdated: true });
    }

    setSettingsError(null);
    setSettingsDialogOpen(false);
    setFeedback({
      open: true,
      severity: 'success',
      message: settingsForm.password
        ? 'Se actualizaron los datos y la contraseña de esta sesión.'
        : 'Datos del perfil actualizados correctamente.'
    });

    setSettingsForm((previous) => ({
      ...previous,
      password: '',
      confirmPassword: ''
    }));
  };

  const organizationName = branding.hotelName || DEFAULT_BRANDING.hotelName;
  const organizationTagline = branding.tagline || DEFAULT_BRANDING.tagline;
  const roleLabel = (user?.rol_nombre || user?.rol || 'Sin rol').toString().toUpperCase();
  const namespaceLabel = (user?.namespace || 'tenant_default').toString().toUpperCase();
  const departmentLabel = user?.departamento_nombre || 'No asignado';
  const accessLevel = user?.nivel_acceso || user?.rol || 'N/D';
  const lastAccess = formatDateTime(user?.ultimo_acceso);
  const createdAt = formatDateTime(user?.fecha_creacion);
  const avatarInitials = user?.nombre
    ? user.nombre
        .split(' ')
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase())
        .join('')
        .slice(0, 2)
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : 'FG';

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      description: 'Panel principal con KPIs'
    },
    {
      text: 'Disponibilidad',
      icon: <EventAvailableIcon />,
      path: '/disponibilidad',
      description: 'Habitaciones con cupo libre'
    },
    {
      text: 'Alojamientos',
      icon: <HotelIcon />,
      path: '/alojamientos',
      description: 'Gestión de unidades'
    },
    {
      text: 'Colaboradores',
      icon: <GroupIcon />,
      path: '/colaboradores',
      description: 'Personal y turnos'
    },
    {
      text: 'Reportar',
      icon: <NoteAddIcon />,
      path: '/mtto-reportar',
      description: 'Crear reporte de mantenimiento'
    },
    {
      text: 'MTTO Reportes',
      icon: <HandymanIcon />,
      path: '/mtto-reportes',
      description: 'Seguimiento de incidentes de mantenimiento'
    }
  ];

  const adminItems = [
    {
      text: 'Administrador',
      icon: <SettingsIcon />,
      path: '/administrador',
      description: 'Usuarios y permisos'
    },
    {
      text: 'Ayuda',
      icon: <HelpIcon />,
      path: '/ayuda',
      description: 'Documentación y soporte'
    }
  ];

  const drawer = (
    <Box>
      {/* Logo y título */}
      <Toolbar sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <HotelIcon sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {branding.hotelName || DEFAULT_BRANDING.hotelName}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {branding.tagline || DEFAULT_BRANDING.tagline}
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider />

      {/* Menú principal */}
      <List sx={{ px: 2, py: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={item.description} placement="right" arrow>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (mobileOpen) {
                    setMobileOpen(false);
                  }
                }}
                selected={location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderLeft: '4px solid #4f46e5',
                    '& .MuiListItemIcon-root': {
                      color: '#4f46e5',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#4f46e5',
                      fontWeight: 600,
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(79, 70, 229, 0.05)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                    fontWeight: location.pathname === item.path ? 600 : 400
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2 }} />

      {/* Menú de administración */}
      <List sx={{ px: 2, py: 1 }}>
        <ListItem>
          <Typography variant="overline" color="textSecondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
            Administración
          </Typography>
        </ListItem>
        {adminItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={item.description} placement="right" arrow>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (mobileOpen) {
                    setMobileOpen(false);
                  }
                }}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderLeft: '4px solid #4f46e5',
                    '& .MuiListItemIcon-root': {
                      color: '#4f46e5',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#4f46e5',
                      fontWeight: 600,
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(79, 70, 229, 0.05)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                    fontWeight: location.pathname === item.path ? 600 : 400
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {/* Usuario actual */}
      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', p: 2 }}>
        <Box 
          sx={{ 
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: 2,
            p: 2,
            border: '1px solid rgba(79, 70, 229, 0.2)'
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: '#4f46e5', width: 40, height: 40 }}>
              {avatarInitials}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.nombre || 'Administrador'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {roleLabel || 'ADMIN'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Notificaciones */}
          <Tooltip title="Notificaciones">
            <IconButton color="inherit" sx={{ mr: 1 }}>
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Menú de usuario */}
          <Tooltip title="Cuenta de usuario">
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem
              onClick={() => {
                handleClose();
                setProfileDialogOpen(true);
              }}
            >
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              Perfil
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                setSettingsError(null);
                setSettingsForm((previous) => ({
                  ...previous,
                  password: '',
                  confirmPassword: ''
                }));
                setSettingsDialogOpen(true);
              }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Configuración
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Perfil del usuario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: '#4f46e5', width: 56, height: 56 }}>
                {avatarInitials}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {user?.nombre || 'Usuario sin nombre'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip label={roleLabel} size="small" color="primary" variant="outlined" />
                  <Chip label={accessLevel.toString().toUpperCase()} size="small" variant="outlined" />
                </Stack>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Correo electrónico</Typography>
                <Typography variant="body2">{user?.email || 'No especificado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                <Typography variant="body2">{user?.telefono || 'No especificado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Organización</Typography>
                <Typography variant="body2">{organizationName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Departamento</Typography>
                <Typography variant="body2">{departmentLabel}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Namespace</Typography>
                <Typography variant="body2">{namespaceLabel}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Último acceso</Typography>
                <Typography variant="body2">{lastAccess}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Miembro desde</Typography>
                <Typography variant="body2">{createdAt}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Descripción de la organización</Typography>
                <Typography variant="body2">{organizationTagline}</Typography>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <form id="user-settings-form" onSubmit={handleSettingsSubmit}>
          <DialogTitle>Configuración de la cuenta</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Actualiza tu información personal para personalizar la experiencia. Los cambios se aplican en esta sesión de demostración.
              </Typography>
              {settingsError ? (
                <Alert severity="error" onClose={() => setSettingsError(null)}>
                  {settingsError}
                </Alert>
              ) : null}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre"
                    value={settingsForm.nombre}
                    onChange={handleSettingsFieldChange('nombre')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Apellidos"
                    value={settingsForm.apellidos}
                    onChange={handleSettingsFieldChange('apellidos')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Correo"
                    value={settingsForm.email}
                    onChange={handleSettingsFieldChange('email')}
                    fullWidth
                    disabled
                    helperText="El correo se gestiona desde administración"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Teléfono"
                    value={settingsForm.telefono}
                    onChange={handleSettingsFieldChange('telefono')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nueva contraseña"
                    value={settingsForm.password}
                    onChange={handleSettingsFieldChange('password')}
                    type="password"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Confirmar contraseña"
                    value={settingsForm.confirmPassword}
                    onChange={handleSettingsFieldChange('confirmPassword')}
                    type="password"
                    fullWidth
                    helperText={settingsForm.password ? 'Escribe de nuevo la nueva contraseña' : ''}
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Guardar cambios</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={feedback.open}
        autoHideDuration={4000}
        onClose={handleFeedbackClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleFeedbackClose} severity={feedback.severity} variant="filled" sx={{ width: '100%' }}>
          {feedback.message}
        </Alert>
      </Snackbar>

      {/* Contenido principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: '#f8fafc'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default NavigationLayout;
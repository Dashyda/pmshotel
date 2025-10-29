import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Fade
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Hotel as HotelIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { DEFAULT_BRANDING, loadBranding, subscribeBranding } from '../utils/branding';
const Login = ({ onLogin, loading: appLoading = false }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    const { branding: initialBranding } = loadBranding();
    setBranding(initialBranding);
    const unsubscribe = subscribeBranding((next) => {
      setBranding((prev) => ({ ...prev, ...next }));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const syncAutofillValues = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      const emailValue = emailInput?.value || '';
      const passwordValue = passwordInput?.value || '';

      if (emailValue || passwordValue) {
        setFormData((prev) => {
          if (prev.email === emailValue && prev.password === passwordValue) {
            return prev;
          }
          return {
            email: emailValue,
            password: passwordValue
          };
        });
      }
    };

    const autofillTimer = window.setTimeout(syncAutofillValues, 150);
    syncAutofillValues();

    return () => {
      window.clearTimeout(autofillTimer);
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Limpiar error al escribir
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onLogin(formData);

      if (!result?.success) {
        setError(result?.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const loginBackgroundUrl =
    typeof branding.loginBackgroundUrl === 'string' && branding.loginBackgroundUrl.trim().length > 0
      ? branding.loginBackgroundUrl
      : DEFAULT_BRANDING.loginBackgroundUrl;

  const resolvedBackgroundUrl = loginBackgroundUrl
    ? loginBackgroundUrl.startsWith('http')
      ? loginBackgroundUrl
      : `${process.env.PUBLIC_URL || ''}${loginBackgroundUrl}`
    : null;

  const backgroundLayer = 'linear-gradient(135deg, rgba(10, 35, 66, 0.65) 0%, rgba(25, 83, 135, 0.65) 100%)';
  const backgroundImage = resolvedBackgroundUrl
    ? `${backgroundLayer}, url("${resolvedBackgroundUrl}")`
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: 2
      }}
    >
      <Fade in timeout={800}>
        <Card
          sx={{
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            borderRadius: 3,
            overflow: 'visible',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Logo y título */}
            <Box textAlign="center" mb={4}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  mb: 2,
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)'
                }}
              >
                <HotelIcon sx={{ fontSize: 40 }} />
              </Box>
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {branding.hotelName || DEFAULT_BRANDING.hotelName}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {branding.tagline || DEFAULT_BRANDING.tagline || 'Sistema de Gestión de Propiedades'}
              </Typography>
            </Box>

            {/* Formulario */}
            <Box component="form" onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <TextField
                fullWidth
                name="email"
                label="Email o usuario"
                value={formData.email}
                onChange={handleChange}
                margin="normal"
                required
                autoComplete="email"
                autoFocus
                sx={{ mb: 2 }}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                name="password"
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                margin="normal"
                required
                autoComplete="current-password"
                sx={{ mb: 3 }}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleTogglePassword}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || appLoading}
                startIcon={loading || appLoading ? <CircularProgress size={20} /> : <LoginIcon />}
                sx={{
                  py: 1.5,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
};

export default Login;
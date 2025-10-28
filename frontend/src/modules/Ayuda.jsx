import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const Ayuda = () => {
  const [guideOpen, setGuideOpen] = useState(false);
  const supportImageUrl = `${process.env.PUBLIC_URL || ''}/assets/support/franklin-diaz.jpg`;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Centro de Ayuda
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Manuales, tutoriales y canales de soporte para sacar el máximo provecho del PMS.
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Avatar
            src={supportImageUrl}
            alt="Franklin Diaz"
            sx={{ width: 112, height: 112, borderRadius: '16px' }}
          />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Franklin Diaz
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Nuestro sistema PMS centraliza reservas, operaciones y experiencia del huésped en una sola plataforma
              pensada para equipos hoteleros modernos. Estamos listos para ayudarte a sacarle el máximo provecho.
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Correo:</strong> <a href="mailto:pinkievani17@gmail.com">pinkievani17@gmail.com</a>
              </Typography>
              <Typography variant="body2">
                <strong>Teléfono:</strong> <a href="tel:+18496217181">+1 849 621 7181</a>
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <HelpOutlineIcon color="primary" sx={{ fontSize: 48 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>¿Necesitas ayuda rápida?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Revisa nuestra guía rápida paso a paso o escríbenos para recibir acompañamiento personalizado.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                onClick={() => setGuideOpen(true)}
              >
                Ver guía rápida
              </Button>
              <Button
                variant="outlined"
                component="a"
                href="mailto:pinkievani17@gmail.com"
              >
                Contactar soporte
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Dialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Guía rápida de nuestro PMS</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Sigue estos pasos para iniciar con las funciones principales:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            1. Ingresa con tus credenciales y confirma tu perfil desde el menú superior.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            2. Revisa el dashboard para visualizar ocupación, ingresos y movimientos del día.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            3. Gestiona reservas y colaboradores en el módulo de Alojamientos; utiliza la búsqueda rápida para localizar unidades.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            4. Actualiza el estado de habitaciones y registra inspecciones desde la vista de Disponibilidad.
          </Typography>
          <Typography variant="body2">
            5. Consulta este Centro de Ayuda para soporte adicional o escríbeme cuando necesites acompañamiento.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuideOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Ayuda;

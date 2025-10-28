import React from 'react';
import { Box, Typography, Grid, Paper, Stack, TextField, Button } from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';

const Huespedes = () => {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Base de Huéspedes
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Gestiona perfiles, preferencias, programas de fidelización y comunicaciones personalizadas.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <PeopleAltIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="h6">Huéspedes registrados</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>4.820</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <LocalActivityIcon color="secondary" fontSize="large" />
              <Box>
                <Typography variant="h6">Miembros Loyalty</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>1.245</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <EmojiEmotionsIcon color="success" fontSize="large" />
              <Box>
                <Typography variant="h6">Puntuación media</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>4.7</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>Buscar huéspedes</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth label="Nombre o email" placeholder="Ej. María García" />
          <TextField fullWidth label="Documento" placeholder="Ej. DNI 12345678" />
          <Button variant="contained" sx={{ minWidth: 160 }}>Buscar</Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Huespedes;

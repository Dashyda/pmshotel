import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { alojamientosAPI, getCurrentUser, handleAPIError } from '../services/api';
import {
  MTTO_AREA_OPTIONS,
  MTTO_CATEGORY_OPTIONS,
  MTTO_PRIORITY_OPTIONS,
  loadStoredMttoReports,
  notifyMttoReportsUpdated,
  saveMttoReports
} from './mttoConstants';

const MAX_NOTE_LENGTH = 600;
const MAX_ZONE_LENGTH = 120;

const createReportId = () => `REP-${Date.now()}`;

const MTTOReportar = () => {
  const [palaces, setPalaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    palaceId: '',
    floorId: '',
    apartmentId: '',
    roomId: '',
    area: '',
    zone: '',
    note: '',
    category: 'General',
    priority: 'Media',
    imageData: '',
    imageName: ''
  });

  const currentUser = useMemo(() => getCurrentUser(), []);

  useEffect(() => {
    const fetchPalaces = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await alojamientosAPI.getPalaces();
        const palacesData = data?.palaces ?? data?.data ?? data ?? [];
        setPalaces(Array.isArray(palacesData) ? palacesData : []);
      } catch (err) {
        setError(handleAPIError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPalaces();
  }, []);

  const selectedPalace = useMemo(
    () => palaces.find((item) => item.id === form.palaceId) || null,
    [palaces, form.palaceId]
  );

  const apartmentOptions = useMemo(() => {
    if (!selectedPalace) {
      return [];
    }
    return selectedPalace.floors?.flatMap((floor) =>
      (floor.apartments || []).map((apartment) => ({
        id: apartment.id,
        name: apartment.name,
        floorId: floor.id,
        floorName: floor.name,
        rooms: apartment.rooms || []
      }))
    ) || [];
  }, [selectedPalace]);

  const selectedApartmentOption = useMemo(
    () => apartmentOptions.find((item) => item.id === form.apartmentId) || null,
    [apartmentOptions, form.apartmentId]
  );

  const roomOptions = useMemo(() => {
    if (!selectedApartmentOption) {
      return [];
    }
    return selectedApartmentOption.rooms.map((room) => ({
      id: room.id,
      name: room.name
    }));
  }, [selectedApartmentOption]);

  const selectedRoomOption = useMemo(
    () => roomOptions.find((item) => item.id === form.roomId) || null,
    [roomOptions, form.roomId]
  );

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectPalace = (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      palaceId: value,
      floorId: '',
      apartmentId: '',
      roomId: ''
    }));
  };

  const handleSelectApartment = (event) => {
    const { value } = event.target;
    const option = apartmentOptions.find((item) => item.id === value) || null;
    setForm((prev) => ({
      ...prev,
      apartmentId: value,
      floorId: option?.floorId || '',
      roomId: ''
    }));
  };

  const handleSelectRoom = (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      roomId: value
    }));
  };

  const handleImageChange = (event) => {
    const { files } = event.target;
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Selecciona un archivo de imagen válido.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        imageData: typeof reader.result === 'string' ? reader.result : '',
        imageName: file.name
      }));
      setFeedback(null);
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'No se pudo leer la imagen seleccionada.' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({
      ...prev,
      imageData: '',
      imageName: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setForm({
      palaceId: '',
      floorId: '',
      apartmentId: '',
      roomId: '',
      area: '',
      zone: '',
      note: '',
      category: 'General',
      priority: 'Media',
      imageData: '',
      imageName: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.palaceId) {
      setFeedback({ type: 'error', message: 'Selecciona el edificio PALACE del reporte.' });
      return;
    }

    if (!form.apartmentId || !selectedApartmentOption) {
      setFeedback({ type: 'error', message: 'Selecciona el apartamento correspondiente.' });
      return;
    }

    if (!form.roomId || !selectedRoomOption) {
      setFeedback({ type: 'error', message: 'Selecciona la habitación donde se reporta la incidencia.' });
      return;
    }

    const zoneValue = form.zone.trim();
    if (!zoneValue) {
      setFeedback({ type: 'error', message: 'Indica la zona del reporte.' });
      return;
    }

    const noteValue = form.note.trim();
    if (!noteValue) {
      setFeedback({ type: 'error', message: 'Ingresa una nota que detalle el mantenimiento requerido.' });
      return;
    }

    const areaOption = MTTO_AREA_OPTIONS.find((item) => item.value === form.area);

    try {
      setSubmitting(true);

      const { reports: storedReports } = loadStoredMttoReports();

      const palaceName = selectedPalace?.name || 'PALACE';
      const apartmentName = selectedApartmentOption?.name || 'Apartamento';
      const floorName = selectedApartmentOption?.floorName || '';
      const roomName = selectedRoomOption?.name || 'Habitación';
      const locationSegments = [palaceName, floorName, apartmentName, roomName].filter(Boolean);

      const reporterName = currentUser?.nombre
        ? `${currentUser.nombre}${currentUser.apellido ? ` ${currentUser.apellido}` : ''}`
        : 'Recepción';

      const newReport = {
        id: createReportId(),
        apartment: locationSegments.join(' • '),
        category: form.category,
        description: noteValue,
        priority: form.priority,
        reportedBy: reporterName,
        reportedAt: new Date().toISOString(),
        status: 'open',
        zone: zoneValue,
        areaLabel: areaOption ? areaOption.label : '',
        areaValue: areaOption ? areaOption.value : '',
        notes: '',
        image: form.imageData,
        imageName: form.imageName,
        palaceId: form.palaceId,
        floorId: form.floorId,
        apartmentId: form.apartmentId,
        roomId: form.roomId,
        floorName,
        roomName
      };

  const reportsToSave = [newReport, ...storedReports];
  saveMttoReports(reportsToSave);
  notifyMttoReportsUpdated();

      setFeedback({ type: 'success', message: 'Reporte registrado y enviado al panel de mantenimiento.' });
      resetForm();
    } catch (err) {
      setFeedback({ type: 'error', message: handleAPIError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Reportar mantenimiento
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Crea un nuevo reporte indicando la ubicación exacta, la zona afectada y adjunta una fotografía de referencia para el equipo de MTTO.
          </Typography>
        </Box>
        <AssignmentIcon color="primary" sx={{ fontSize: 48 }} />
      </Stack>

      <Divider sx={{ my: 3 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert
          severity={feedback.type === 'error' ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Edificio PALACE"
                  value={form.palaceId}
                  onChange={handleSelectPalace}
                  fullWidth
                  required
                  disabled={loading}
                >
                  <MenuItem value="">
                    <em>Selecciona un edificio</em>
                  </MenuItem>
                  {palaces.map((palace) => (
                    <MenuItem key={palace.id} value={palace.id}>
                      {palace.name || `PALACE ${palace.seriesNumber || ''}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Apartamento"
                  value={form.apartmentId}
                  onChange={handleSelectApartment}
                  fullWidth
                  required
                  disabled={!form.palaceId || apartmentOptions.length === 0}
                >
                  <MenuItem value="">
                    <em>Selecciona un apartamento</em>
                  </MenuItem>
                  {apartmentOptions.map((apartment) => (
                    <MenuItem key={apartment.id} value={apartment.id}>
                      {apartment.name} {apartment.floorName ? `• ${apartment.floorName}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Habitación"
                  value={form.roomId}
                  onChange={handleSelectRoom}
                  fullWidth
                  required
                  disabled={!form.apartmentId || roomOptions.length === 0}
                >
                  <MenuItem value="">
                    <em>Selecciona la habitación</em>
                  </MenuItem>
                  {roomOptions.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      {room.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Área afectada"
                  value={form.area}
                  onChange={handleFieldChange('area')}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>Selecciona el área</em>
                  </MenuItem>
                  {MTTO_AREA_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Categoría"
                  value={form.category}
                  onChange={handleFieldChange('category')}
                  fullWidth
                >
                  {MTTO_CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Prioridad"
                  value={form.priority}
                  onChange={handleFieldChange('priority')}
                  fullWidth
                >
                  {MTTO_PRIORITY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Zona del reporte"
              value={form.zone}
              onChange={handleFieldChange('zone')}
              placeholder="Ej. Pared derecha, techo, puerta principal"
              inputProps={{ maxLength: MAX_ZONE_LENGTH }}
              helperText={`${form.zone.length}/${MAX_ZONE_LENGTH} caracteres`}
              required
              fullWidth
            />

            <TextField
              label="Descripción detallada"
              value={form.note}
              onChange={handleFieldChange('note')}
              placeholder="Describe la incidencia, acciones tomadas y observaciones relevantes"
              inputProps={{ maxLength: MAX_NOTE_LENGTH }}
              helperText={`${form.note.length}/${MAX_NOTE_LENGTH} caracteres`}
              required
              multiline
              minRows={4}
              fullWidth
            />

            <Stack spacing={1}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={fileInputRef}
                  onChange={handleImageChange}
                />
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Adjuntar imagen
                </Button>
                {form.imageData ? (
                  <Button
                    variant="text"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={handleRemoveImage}
                  >
                    Quitar imagen
                  </Button>
                ) : null}
              </Stack>
              {form.imageData ? (
                <Box
                  component="img"
                  src={form.imageData}
                  alt={form.imageName || 'Imagen del reporte'}
                  sx={{ maxWidth: 320, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Formatos soportados: JPG, PNG, HEIC. Tamaño recomendado &lt; 5MB.
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="button"
                variant="text"
                onClick={resetForm}
                disabled={submitting}
              >
                Limpiar formulario
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || loading}
              >
                {submitting ? 'Enviando...' : 'Crear reporte'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default MTTOReportar;

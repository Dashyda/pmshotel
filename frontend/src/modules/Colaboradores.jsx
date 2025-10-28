import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { colaboradoresAPI, handleAPIError } from '../services/api';

const formatDate = (value) => {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(parsed);
};

const defaultExitDateValue = () => {
  return new Date().toISOString().split('T')[0];
};

const RETIRE_REASON_OPTIONS = [
  { value: 'Baja', label: 'Baja' },
  { value: 'Entrega voluntaria', label: 'Entrega voluntaria' }
];

const MAINTENANCE_AREA_LABELS = {
  room: 'Habitación',
  bathroom: 'Baños',
  common: 'Zona común'
};

const getMaintenanceAreaLabel = (value) => {
  if (!value) {
    return '';
  }
  const normalized = String(value).toLowerCase();
  return MAINTENANCE_AREA_LABELS[normalized] || '';
};

const defaultEntryDateValue = () => {
  return new Date().toISOString().split('T')[0];
};

const defaultCreateForm = () => ({
  codigo: '',
  cedula: '',
  nombre: '',
  apellido: '',
  departamento: '',
  posicion: '',
  fechaEntrada: defaultEntryDateValue(),
  fechaSalida: ''
});

const Colaboradores = () => {
  const navigate = useNavigate();
  const [collaborators, setCollaborators] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const createDefaultRetireDialog = () => ({
    open: false,
    collaborator: null,
    fechaSalida: defaultExitDateValue(),
    motivoRetiro: RETIRE_REASON_OPTIONS[0].value
  });

  const [retireDialog, setRetireDialog] = useState(() => createDefaultRetireDialog());
  const [retiring, setRetiring] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm());
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const fileInputRef = useRef(null);

  const loadCollaborators = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await colaboradoresAPI.getColaboradores();
      setCollaborators(data?.colaboradores ?? []);
      setMeta(data?.meta ?? null);
    } catch (err) {
      setError(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollaborators();
  }, []);

  const filteredCollaborators = useMemo(() => {
    const normalizedQuery = activeQuery.trim().toLowerCase();

    return collaborators.filter((item) => {
      const targetValues = [item.codigo, item.cedula, item.nombre, item.apellido];
      const matchesQuery = !normalizedQuery
        || targetValues.some((value) =>
          value ? String(value).toLowerCase().includes(normalizedQuery) : false
        );

      const matchesDepartment = !departmentFilter
        || (item.departamento && item.departamento === departmentFilter);

      const matchesPosition = !positionFilter
        || (item.posicion && item.posicion === positionFilter);

      return matchesQuery && matchesDepartment && matchesPosition;
    });
  }, [activeQuery, collaborators, departmentFilter, positionFilter]);

  const handleSearch = () => {
    setActiveQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    setDepartmentFilter('');
    setPositionFilter('');
  };

  const openCreateDialog = () => {
    setCreateForm(defaultCreateForm());
    setCreateErrors({});
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = (force = false) => {
    if (creating && !force) {
      return;
    }
    setCreateDialogOpen(false);
    setCreateForm(defaultCreateForm());
    setCreateErrors({});
  };

  const handleCreateDialogClose = (event, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      closeCreateDialog();
      return;
    }
    closeCreateDialog();
  };

  const handleCreateFieldChange = (field) => (event) => {
    const { value } = event.target;
    setCreateForm((prev) => ({
      ...prev,
      [field]: value
    }));
    if (createErrors[field]) {
      setCreateErrors((prev) => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateCreateForm = () => {
    const errors = {};
    if (!createForm.codigo.trim()) {
      errors.codigo = 'Código requerido';
    }
    if (!createForm.cedula.trim()) {
      errors.cedula = 'Documento requerido';
    }
    if (!createForm.nombre.trim()) {
      errors.nombre = 'Nombre requerido';
    }
    if (!createForm.apellido.trim()) {
      errors.apellido = 'Apellido requerido';
    }
    if (!createForm.departamento.trim()) {
      errors.departamento = 'Departamento requerido';
    }
    if (!createForm.posicion.trim()) {
      errors.posicion = 'Posición requerida';
    }
    if (!createForm.fechaEntrada) {
      errors.fechaEntrada = 'Fecha de ingreso requerida';
    }
    if (createForm.fechaEntrada && createForm.fechaSalida && createForm.fechaSalida < createForm.fechaEntrada) {
      errors.fechaSalida = 'La salida no puede ser antes del ingreso';
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitCreate = async () => {
    if (!validateCreateForm()) {
      return;
    }

    try {
      setCreating(true);
      const payload = {
        codigo: createForm.codigo.trim(),
        cedula: createForm.cedula.trim(),
        nombre: createForm.nombre.trim(),
        apellido: createForm.apellido.trim(),
        departamento: createForm.departamento.trim(),
        posicion: createForm.posicion.trim(),
        fechaEntrada: createForm.fechaEntrada,
        fechaSalida: createForm.fechaSalida || null
      };

      const { data } = await colaboradoresAPI.createColaborador(payload);
      const newCollaborator = data?.colaborador;

      if (!newCollaborator) {
        throw new Error('No se recibió el colaborador creado');
      }

      setCollaborators((prev) => [newCollaborator, ...prev]);
      setMeta((prev) => data?.meta ?? prev);

      setFeedback({
        type: 'success',
        message: `${payload.nombre} ${payload.apellido} fue registrado correctamente.`
      });
      closeCreateDialog(true);
    } catch (err) {
      const message = handleAPIError(err) || 'No se pudo crear el colaborador';
      setFeedback({ type: 'error', message });
    } finally {
      setCreating(false);
    }
  };

  const summaryChips = useMemo(() => {
    if (!meta) {
      return [];
    }
    return [
      { label: 'Total de colaboradores', value: meta.total, color: 'primary' },
      { label: 'Activos', value: meta.activos, color: 'success' },
      { label: 'Retirados', value: meta.retirados, color: 'default' }
    ];
  }, [meta]);

  const departmentOptions = useMemo(() => {
    const values = new Set();
    collaborators.forEach((item) => {
      if (item?.departamento) {
        values.add(item.departamento);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [collaborators]);

  const positionOptions = useMemo(() => {
    const values = new Set();
    collaborators.forEach((item) => {
      if (departmentFilter && item?.departamento !== departmentFilter) {
        return;
      }
      if (item?.posicion) {
        values.add(item.posicion);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [collaborators, departmentFilter]);

  useEffect(() => {
    if (positionFilter && !positionOptions.includes(positionFilter)) {
      setPositionFilter('');
    }
  }, [positionFilter, positionOptions]);

  const closeFeedback = () => setFeedback(null);

  const openRetireDialog = (collaborator) => {
    const availableReasons = RETIRE_REASON_OPTIONS.map((option) => option.value);
    const defaultReason = RETIRE_REASON_OPTIONS[0].value;
    const collaboratorReason = collaborator?.motivoRetiro && availableReasons.includes(collaborator.motivoRetiro)
      ? collaborator.motivoRetiro
      : defaultReason;

    setRetireDialog({
      open: true,
      collaborator,
      fechaSalida: defaultExitDateValue(),
      motivoRetiro: collaboratorReason
    });
  };

  const closeRetireDialog = () => {
    if (retiring) {
      return;
    }
    setRetireDialog(createDefaultRetireDialog());
  };

  const handleConfirmRetire = async () => {
    if (!retireDialog.collaborator) {
      return;
    }

    if (!retireDialog.motivoRetiro) {
      setFeedback({ type: 'error', message: 'Selecciona un motivo de retiro.' });
      return;
    }

    try {
      setRetiring(true);
      const { data } = await colaboradoresAPI.retire(retireDialog.collaborator.id, {
        fechaSalida: retireDialog.fechaSalida,
        motivoRetiro: retireDialog.motivoRetiro
      });

      setCollaborators((prev) =>
        prev.map((item) => (item.id === data?.colaborador?.id ? data.colaborador : item))
      );
      setMeta((prev) => data?.meta ?? prev);

      setFeedback({
        type: 'success',
        message: `${retireDialog.collaborator.nombre} ${retireDialog.collaborator.apellido} fue retirado correctamente. Motivo: ${retireDialog.motivoRetiro}.`
      });
      closeRetireDialog();
    } catch (err) {
      setFeedback({ type: 'error', message: handleAPIError(err) });
    } finally {
      setRetiring(false);
    }
  };

  const handleNavigateToAssignment = (assignment) => {
    if (!assignment || !assignment.palaceId || !assignment.roomId) {
      return;
    }

    navigate('/alojamientos', {
      state: {
        focusPalaceId: assignment.palaceId,
        focusFloorId: assignment.floorId,
        focusApartmentId: assignment.apartmentId,
        focusRoomId: assignment.roomId,
        focusToken: Date.now()
      }
    });
  };

  const triggerImportClick = () => {
    if (importing) {
      return;
    }
    fileInputRef.current?.click();
  };

  const normalizeExcelKey = (value) => {
    if (!value) {
      return '';
    }
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const normalizeDateValue = (rawValue) => {
    if (rawValue == null) {
      return '';
    }
    const value = String(rawValue).trim();
    if (!value) {
      return '';
    }

    const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      return isoMatch[0];
    }

    const dmyMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmyMatch) {
      const day = String(dmyMatch[1]).padStart(2, '0');
      const month = String(dmyMatch[2]).padStart(2, '0');
      const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return '';
  };

  const handleImportFileChange = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    setImportSummary(null);
    setImporting(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames.length) {
        throw new Error('El archivo no contiene hojas.');
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

      if (!rows.length) {
        throw new Error('La primera hoja no tiene registros para importar.');
      }

      const normalizedRows = rows.map((row) => {
        const normalizedRow = {};
        Object.entries(row).forEach(([key, value]) => {
          const safeKey = normalizeExcelKey(key);
          if (safeKey) {
            normalizedRow[safeKey] = value;
          }
        });
        return normalizedRow;
      });

      const successes = [];
      const failures = [];
      let latestMeta = null;

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const getValue = (key) => {
          const raw = row[key];
          return raw == null ? '' : String(raw).trim();
        };

        const codigo = getValue('codigo');
        const cedula = getValue('cedula');
        const nombre = getValue('nombre');
        const apellido = getValue('apellido');
        const departamento = getValue('departamento');
        const posicion = getValue('posicion');
        const fechaEntrada = normalizeDateValue(row.fechaentrada || row.fechainicio || row.ingreso || getValue('fechaentrada'));
        const fechaSalidaRaw = normalizeDateValue(row.fechasalida || getValue('fechasalida'));

        const missingRequired = [codigo, cedula, nombre, apellido, departamento, posicion, fechaEntrada].some((item) => !item);

        if (missingRequired) {
          failures.push({
            index,
            codigo: codigo || '(sin código)',
            reason: 'Campos obligatorios incompletos.'
          });
          continue;
        }

        const payload = {
          codigo,
          cedula,
          nombre,
          apellido,
          departamento,
          posicion,
          fechaEntrada,
          fechaSalida: fechaSalidaRaw || null
        };

        try {
          const { data } = await colaboradoresAPI.createColaborador(payload);
          if (data?.colaborador) {
            successes.push(data.colaborador);
          }
          if (data?.meta) {
            latestMeta = data.meta;
          }
        } catch (err) {
          failures.push({
            index,
            codigo: codigo || '(sin código)',
            reason: handleAPIError(err)
          });
        }
      }

      if (successes.length > 0) {
        setCollaborators((prev) => [...successes, ...prev]);
      }
      if (latestMeta) {
        setMeta(latestMeta);
      }

      const feedbackType = failures.length > 0 ? 'error' : 'success';
      const message = failures.length > 0
        ? `Importación parcial: ${successes.length} colaboradores añadidos y ${failures.length} registros con errores.`
        : `Importación exitosa: ${successes.length} colaboradores añadidos.`;

      setFeedback({ type: feedbackType, message });
      setImportSummary({
        total: normalizedRows.length,
        successes: successes.length,
        failures,
        filename: file.name
      });
    } catch (err) {
      const message = err?.message || 'No se pudo procesar el archivo seleccionado.';
      setFeedback({ type: 'error', message });
    } finally {
      setImporting(false);
      if (event.target) {
        // reset input value to allow importing the same file twice
        event.target.value = '';
      }
    }
  };

  const handleClearImportSummary = () => {
    setImportSummary(null);
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Maestro de colaboradores
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Consulta el personal registrado y gestiona las bajas del alojamiento.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            disabled={loading}
          >
            Nuevo colaborador
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={triggerImportClick}
            disabled={loading || importing}
          >
            {importing ? 'Importando...' : 'Importar Excel'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCollaborators}
            disabled={loading}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImportFileChange}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
        <TextField
          placeholder="Buscar por código, nombre o cédula"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
          sx={{ flexGrow: 1, minWidth: { xs: '100%', md: 240 } }}
        />
        <TextField
          select
          label="Departamento"
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          SelectProps={{
            displayEmpty: true,
            renderValue: (selected) => (selected === '' ? 'Todos los departamentos' : selected)
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { xs: '100%', md: 220 } }}
          disabled={loading || departmentOptions.length === 0}
        >
          <MenuItem value="">Todos los departamentos</MenuItem>
          {departmentOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Posición"
          value={positionFilter}
          onChange={(event) => setPositionFilter(event.target.value)}
          SelectProps={{
            displayEmpty: true,
            renderValue: (selected) => (selected === '' ? 'Todas las posiciones' : selected)
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { xs: '100%', md: 220 } }}
          disabled={loading || positionOptions.length === 0}
        >
          <MenuItem value="">Todas las posiciones</MenuItem>
          {positionOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            Buscar
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearSearch}
            disabled={loading || (!searchInput && !activeQuery && !departmentFilter && !positionFilter)}
          >
            Limpiar
          </Button>
        </Stack>
      </Stack>

      {summaryChips.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Chip icon={<PeopleIcon />} label={`${summaryChips[0].label}: ${summaryChips[0].value}`} color="primary" />
            <Chip label={`${summaryChips[1].label}: ${summaryChips[1].value}`} color="success" variant="outlined" />
            <Chip label={`${summaryChips[2].label}: ${summaryChips[2].value}`} variant="outlined" />
          </Stack>
        </Paper>
      )}

      <Collapse in={Boolean(error)}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <IconButton color="inherit" size="small" onClick={() => { setError(null); loadCollaborators(); }}>
                <RefreshIcon fontSize="inherit" />
              </IconButton>
            }
          >
            {error}
          </Alert>
        )}
      </Collapse>

      <Collapse in={Boolean(feedback)}>
        {feedback && (
          <Alert
            sx={{ mb: 2 }}
            severity={feedback.type === 'error' ? 'error' : 'success'}
            action={
              <IconButton size="small" color="inherit" onClick={closeFeedback}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {feedback.message}
          </Alert>
        )}
      </Collapse>

      {importSummary && importSummary.failures?.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Registros no importados
            </Typography>
            <IconButton size="small" onClick={handleClearImportSummary}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Archivo: {importSummary.filename} • Total filas: {importSummary.total} • Importados: {importSummary.successes} • Con errores: {importSummary.failures.length}
          </Typography>
          <Stack spacing={0.5}>
            {importSummary.failures.map((failure) => (
              <Typography key={`${failure.index}-${failure.codigo}`} variant="body2">
                Fila {failure.index + 2} ({failure.codigo}): {failure.reason}
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}

      {loading ? (
        <Paper sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : filteredCollaborators.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">
            {collaborators.length === 0
              ? 'No hay colaboradores registrados.'
              : 'No se encontraron resultados para la búsqueda.'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {collaborators.length === 0
              ? 'Una vez se registren, podrás gestionar sus datos y fecha de salida desde este módulo.'
              : 'Intenta con otro criterio o limpia el filtro para ver todos los colaboradores.'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Cédula</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Apellido</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell>Posición</TableCell>
                <TableCell>Habitaciones asignadas</TableCell>
                <TableCell>Fecha de entrada</TableCell>
                <TableCell>Fecha de salida</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCollaborators.map((collaborator) => (
                <TableRow key={collaborator.id} hover>
                  <TableCell>{collaborator.codigo}</TableCell>
                  <TableCell>{collaborator.cedula}</TableCell>
                  <TableCell>{collaborator.nombre}</TableCell>
                  <TableCell>{collaborator.apellido}</TableCell>
                  <TableCell>{collaborator.departamento}</TableCell>
                  <TableCell>{collaborator.posicion}</TableCell>
                  <TableCell>
                    {Array.isArray(collaborator.assignedRooms) && collaborator.assignedRooms.length > 0 ? (
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        {collaborator.assignedRooms.map((assignment) => {
                          const tooltipSections = [
                            assignment.palaceName,
                            assignment.floorName,
                            assignment.apartmentName
                          ];

                          if (assignment.apartmentStatus === 'out_of_service') {
                            tooltipSections.push('Apartamento fuera de servicio');
                            if (assignment.apartmentOutOfServiceNote) {
                              tooltipSections.push(`Motivo: ${assignment.apartmentOutOfServiceNote}`);
                            }
                          }

                          if (assignment.status === 'maintenance') {
                            if (assignment.maintenanceZone) {
                              tooltipSections.push(`Zona: ${assignment.maintenanceZone}`);
                            }
                            const maintenanceAreaLabel = getMaintenanceAreaLabel(assignment.maintenanceAreaType);
                            if (maintenanceAreaLabel) {
                              tooltipSections.push(`Área: ${maintenanceAreaLabel}`);
                            }
                            if (assignment.maintenanceNote) {
                              tooltipSections.push(`Nota: ${assignment.maintenanceNote}`);
                            }
                          }

                          const tooltipTitle = tooltipSections.filter(Boolean).join(' • ');
                          const chipColor =
                            assignment.apartmentStatus === 'out_of_service' || assignment.status === 'maintenance'
                              ? 'warning'
                              : 'primary';

                          return (
                            <Tooltip
                              key={`${collaborator.id}-${assignment.roomId}`}
                              title={tooltipTitle}
                            >
                              <Chip
                                icon={<MeetingRoomIcon fontSize="small" />}
                                clickable
                                size="small"
                                color={chipColor}
                                variant="outlined"
                                label={`${assignment.roomName} - ${assignment.palaceName}`}
                                onClick={() => handleNavigateToAssignment(assignment)}
                              />
                            </Tooltip>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Sin asignación
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(collaborator.fechaEntrada)}</TableCell>
                  <TableCell>{formatDate(collaborator.fechaSalida)}</TableCell>
                  <TableCell>
                    <Chip
                      label={collaborator.activo ? 'Activo' : 'Retirado'}
                      color={collaborator.activo ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => openRetireDialog(collaborator)}
                      disabled={!collaborator.activo}
                    >
                      Retirar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={retireDialog.open} onClose={closeRetireDialog} fullWidth maxWidth="xs">
        <DialogTitle>Retirar colaborador</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {retireDialog.collaborator && (
              <Typography variant="body2" color="text.secondary">
                Confirmas retirar a <strong>{retireDialog.collaborator.nombre} {retireDialog.collaborator.apellido}</strong> del alojamiento?
              </Typography>
            )}
            <TextField
              label="Fecha de salida"
              type="date"
              value={retireDialog.fechaSalida}
              onChange={(event) => setRetireDialog((prev) => ({ ...prev, fechaSalida: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Motivo del retiro"
              select
              value={retireDialog.motivoRetiro}
              onChange={(event) => setRetireDialog((prev) => ({ ...prev, motivoRetiro: event.target.value }))}
            >
              {RETIRE_REASON_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRetireDialog} disabled={retiring}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmRetire}
            disabled={retiring || !retireDialog.fechaSalida || !retireDialog.motivoRetiro}
          >
            {retiring ? 'Guardando...' : 'Confirmar retiro'}
          </Button>
        </DialogActions>
      </Dialog>

  <Dialog open={createDialogOpen} onClose={handleCreateDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo colaborador</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Código"
                value={createForm.codigo}
                onChange={handleCreateFieldChange('codigo')}
                error={Boolean(createErrors.codigo)}
                helperText={createErrors.codigo}
                fullWidth
              />
              <TextField
                label="Documento"
                value={createForm.cedula}
                onChange={handleCreateFieldChange('cedula')}
                error={Boolean(createErrors.cedula)}
                helperText={createErrors.cedula}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Nombre"
                value={createForm.nombre}
                onChange={handleCreateFieldChange('nombre')}
                error={Boolean(createErrors.nombre)}
                helperText={createErrors.nombre}
                fullWidth
              />
              <TextField
                label="Apellido"
                value={createForm.apellido}
                onChange={handleCreateFieldChange('apellido')}
                error={Boolean(createErrors.apellido)}
                helperText={createErrors.apellido}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Departamento"
                value={createForm.departamento}
                onChange={handleCreateFieldChange('departamento')}
                error={Boolean(createErrors.departamento)}
                helperText={createErrors.departamento}
                fullWidth
              />
              <TextField
                label="Posición"
                value={createForm.posicion}
                onChange={handleCreateFieldChange('posicion')}
                error={Boolean(createErrors.posicion)}
                helperText={createErrors.posicion}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Fecha de ingreso"
                type="date"
                value={createForm.fechaEntrada}
                onChange={handleCreateFieldChange('fechaEntrada')}
                error={Boolean(createErrors.fechaEntrada)}
                helperText={createErrors.fechaEntrada}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Fecha de salida (opcional)"
                type="date"
                value={createForm.fechaSalida}
                onChange={handleCreateFieldChange('fechaSalida')}
                error={Boolean(createErrors.fechaSalida)}
                helperText={createErrors.fechaSalida}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={creating}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmitCreate}
            disabled={creating}
          >
            {creating ? 'Guardando...' : 'Guardar colaborador'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Colaboradores;

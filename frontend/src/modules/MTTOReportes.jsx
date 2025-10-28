import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  LinearProgress
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PrintIcon from '@mui/icons-material/Print';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  MTTO_CATEGORY_OPTIONS,
  MTTO_PRIORITY_OPTIONS,
  loadStoredMttoReports,
  notifyMttoReportsUpdated,
  saveMttoReports
} from './mttoConstants';
import { loadActiveTenantNamespace, subscribeActiveTenantNamespace, DEFAULT_TENANT } from '../utils/branding';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const INITIAL_REPORTS = [
  {
    id: 'REP-001',
    apartment: 'PALACE 01 • Apto 201',
    category: 'Eléctrico',
    description: 'Falla en iluminación del baño principal.',
    priority: 'Alta',
    reportedBy: 'Recepción',
    reportedAt: '2025-10-24T09:15:00Z',
    status: 'open',
    notes: ''
  },
  {
    id: 'REP-002',
    apartment: 'PALACE 02 • Apto 305',
    category: 'Plomería',
    description: 'Goteo constante en lavamanos de habitación secundaria.',
    priority: 'Media',
    reportedBy: 'Ama de llaves',
    reportedAt: '2025-10-25T13:40:00Z',
    status: 'in_progress',
    technician: 'Equipo MTTO 2',
    notes: 'Requiere repuesto de empaquetadura.'
  },
  {
    id: 'REP-003',
    apartment: 'PALACE 01 • Apto 110',
    category: 'Climatización',
    description: 'AC no enfría adecuadamente, huésped reporta ruido.',
    priority: 'Alta',
    reportedBy: 'Huésped',
    reportedAt: '2025-10-23T18:05:00Z',
    status: 'resolved',
    resolvedAt: '2025-10-24T21:30:00Z',
    technician: 'Equipo MTTO 1',
    notes: 'Se reemplazó ventilador interno y se hizo mantenimiento preventivo.',
    resolutionNote: 'Equipo vuelve a operar dentro de parámetros.'
  },
  {
    id: 'REP-004',
    apartment: 'PALACE 03 • Apto 407',
    category: 'Carpintería',
    description: 'Puerta del closet con bisagra floja.',
    priority: 'Baja',
    reportedBy: 'Supervisión general',
    reportedAt: '2025-10-25T08:10:00Z',
    status: 'open',
    notes: ''
  }
];

const STATUS_META = {
  open: { label: 'Pendiente', color: 'error' },
  in_progress: { label: 'En progreso', color: 'warning' },
  resolved: { label: 'Resuelto', color: 'success' }
};

const formatDate = (value) => {
  if (!value) {
    return 'Sin fecha';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatted = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);

  return formatted.replace(',', ' •');
};

const cloneInitialReports = () => INITIAL_REPORTS.map((item) => ({ ...item }));

const resolveReportsForNamespace = (namespace) => {
  const targetNamespace = (namespace || DEFAULT_TENANT).trim() || DEFAULT_TENANT;
  const { reports: storedReports, hasStoredValue } = loadStoredMttoReports(targetNamespace);
  if (!hasStoredValue) {
    return targetNamespace === DEFAULT_TENANT ? cloneInitialReports() : [];
  }
  return storedReports;
};

const MTTOReportes = () => {
  const initialNamespace = loadActiveTenantNamespace();
  const [activeNamespace, setActiveNamespace] = useState(initialNamespace);
  const [reports, setReports] = useState(() => resolveReportsForNamespace(initialNamespace));
  const [resolveDialog, setResolveDialog] = useState({ open: false, reportId: null, note: '' });
  const [editDialog, setEditDialog] = useState({ open: false, reportId: null, category: '', priority: '' });
  const [clearResolvedDialogOpen, setClearResolvedDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [imagePreview, setImagePreview] = useState({ open: false, src: '', alt: '' });

  useEffect(() => {
    const unsubscribe = subscribeActiveTenantNamespace?.((namespace) => {
      setActiveNamespace(namespace);
      setReports(() => resolveReportsForNamespace(namespace));
    });
    return unsubscribe;
  }, []);

  const persistReports = useCallback((nextReports) => {
    saveMttoReports(nextReports, activeNamespace);
    notifyMttoReportsUpdated(activeNamespace);
  }, [activeNamespace]);

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [reports, statusFilter, priorityFilter]);

  const totals = useMemo(() => {
    const resolved = reports.filter((item) => item.status === 'resolved').length;
    const open = reports.filter((item) => item.status === 'open').length;
    const inProgress = reports.filter((item) => item.status === 'in_progress').length;
    const resolutionRate = reports.length === 0 ? 0 : Math.round((resolved / reports.length) * 100);

    return {
      total: reports.length,
      resolved,
      open,
      inProgress,
      resolutionRate
    };
  }, [reports]);

  const chartData = useMemo(() => {
    return {
      labels: ['Pendientes', 'En progreso', 'Resueltos'],
      datasets: [
        {
          label: 'Reportes',
          data: [totals.open, totals.inProgress, totals.resolved],
          backgroundColor: ['#ef4444', '#f59e0b', '#22c55e']
        }
      ]
    };
  }, [totals]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Estado de reportes de mantenimiento'
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  const handleOpenResolveDialog = (reportId) => {
    setResolveDialog({ open: true, reportId, note: '' });
  };

  const handleCloseResolveDialog = () => {
    setResolveDialog({ open: false, reportId: null, note: '' });
  };

  const handleChangeNote = (event) => {
    const { value } = event.target;
    setResolveDialog((prev) => ({ ...prev, note: value }));
  };

  const handleConfirmResolve = () => {
    setReports((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== resolveDialog.reportId) {
          return item;
        }

        return {
          ...item,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          resolutionNote: resolveDialog.note.trim() || 'Solución informada por mantenimiento.'
        };
      });
      persistReports(updated);
      return updated;
    });

    handleCloseResolveDialog();
  };

  const handleOpenEditDialog = (report) => {
    setEditDialog({
      open: true,
      reportId: report.id,
      category: report.category,
      priority: report.priority
    });
  };

  const handleCloseEditDialog = () => {
    setEditDialog({ open: false, reportId: null, category: '', priority: '' });
  };

  const handleEditFieldChange = (field) => (event) => {
    const { value } = event.target;
    setEditDialog((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirmEdit = () => {
    setReports((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== editDialog.reportId) {
          return item;
        }

        return {
          ...item,
          category: editDialog.category,
          priority: editDialog.priority
        };
      });
      persistReports(updated);
      return updated;
    });

    handleCloseEditDialog();
  };

  const handleMarkInProgress = (reportId) => {
    setReports((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== reportId) {
          return item;
        }

        return {
          ...item,
          status: 'in_progress'
        };
      });
      persistReports(updated);
      return updated;
    });
  };

  const handleMarkPending = (reportId) => {
    setReports((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== reportId) {
          return item;
        }

        return {
          ...item,
          status: 'open'
        };
      });
      persistReports(updated);
      return updated;
    });
  };

  const handleOpenClearResolvedDialog = () => {
    setClearResolvedDialogOpen(true);
  };

  const handleCloseClearResolvedDialog = () => {
    setClearResolvedDialogOpen(false);
  };

  const handleConfirmClearResolved = () => {
    setReports((prev) => {
      const filtered = prev.filter((item) => item.status !== 'resolved');
      persistReports(filtered);
      return filtered;
    });
    handleCloseClearResolvedDialog();
  };

  const handlePrintPendingReports = () => {
    const pendingReports = reports.filter((item) => item.status === 'open');

    if (pendingReports.length === 0) {
      window.alert('No hay reportes pendientes para imprimir.');
      return;
    }

    const printWindow = window.open('', '', 'width=1024,height=768');
    if (!printWindow) {
      window.alert('No se pudo abrir la ventana de impresión. Verifica los bloqueadores emergentes.');
      return;
    }

    const generatedAt = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date());

    const rows = pendingReports
      .map((report) => `
        <tr>
          <td>${report.id}</td>
          <td>${report.apartment}</td>
          <td>${report.category}</td>
          <td>${report.priority}</td>
          <td>${report.description}</td>
          <td>${formatDate(report.reportedAt)}</td>
          <td>Administración</td>
        </tr>
      `)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charSet="utf-8" />
          <title>Reportes pendientes de mantenimiento</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            p { margin: 4px 0 16px; color: #555; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 13px; text-align: left; }
            th { background-color: #f3f4f6; }
            tr:nth-child(even) { background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Reportes pendientes de mantenimiento</h1>
          <p>Generado: ${generatedAt}</p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Apartamento</th>
                <th>Categoría</th>
                <th>Prioridad</th>
                <th>Descripción</th>
                <th>Reportado</th>
                <th>Reportado por</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleOpenImagePreview = (report) => {
    if (!report?.image) {
      return;
    }
    setImagePreview({
      open: true,
      src: report.image,
      alt: report.id ? `Reporte ${report.id}` : 'Reporte de mantenimiento'
    });
  };

  const handleCloseImagePreview = () => {
    setImagePreview({ open: false, src: '', alt: '' });
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            MTTO Reportes
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Visualiza y actualiza los reportes de mantenimiento generados en los apartamentos. Desde aquí el equipo indica el avance y registra la solución aplicada.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintPendingReports}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Imprimir reportes pendientes
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={handleOpenClearResolvedDialog}
            disabled={totals.resolved === 0}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Limpiar resueltos
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <ReportProblemIcon color="error" fontSize="large" />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Reportes activos
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totals.open}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <PendingActionsIcon color="warning" fontSize="large" />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  En progreso
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totals.inProgress}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <AssignmentTurnedInIcon color="success" fontSize="large" />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Resueltos
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totals.resolved}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={2} alignItems="center">
                <BuildIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tasa de resolución
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {totals.resolutionRate}%
                  </Typography>
                </Box>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={totals.resolutionRate}
                sx={{ height: 10, borderRadius: 5 }}
                color={totals.resolutionRate > 70 ? 'success' : totals.resolutionRate > 40 ? 'warning' : 'error'}
              />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 360 }}>
            <Bar data={chartData} options={chartOptions} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 360, overflow: 'auto' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Reportes por categoría
            </Typography>
            <Stack spacing={1.5}>
              {Array.from(new Set(reports.map((item) => item.category))).map((category) => {
                const categoryReports = reports.filter((item) => item.category === category);
                const resolved = categoryReports.filter((item) => item.status === 'resolved').length;
                return (
                  <Box key={category}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {category}
                      </Typography>
                      <Chip
                        label={`${resolved}/${categoryReports.length} resueltos`}
                        color={resolved === categoryReports.length && categoryReports.length > 0 ? 'success' : 'default'}
                        size="small"
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={categoryReports.length === 0 ? 0 : (resolved / categoryReports.length) * 100}
                      sx={{ height: 8, borderRadius: 4, mt: 1 }}
                      color={resolved === categoryReports.length && categoryReports.length > 0 ? 'success' : 'primary'}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          Reportes de mantenimiento
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 220 } }}
          >
            <MenuItem value="all">Todos los estados</MenuItem>
            <MenuItem value="open">Pendientes</MenuItem>
            <MenuItem value="in_progress">En progreso</MenuItem>
            <MenuItem value="resolved">Resueltos</MenuItem>
          </TextField>
          <TextField
            select
            label="Prioridad"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 220 } }}
          >
            <MenuItem value="all">Todas las prioridades</MenuItem>
            {MTTO_PRIORITY_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={2}>
          {filteredReports.length === 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No hay reportes que coincidan con los filtros seleccionados.
              </Typography>
            </Paper>
          )}
          {filteredReports.map((report) => {
            const meta = STATUS_META[report.status] || STATUS_META.open;
            return (
              <Paper key={report.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={report.id} size="small" color="primary" />
                      <Chip label={meta.label} size="small" color={meta.color} />
                      <Chip label={`Prioridad ${report.priority}`} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Reportado: {formatDate(report.reportedAt)} • {report.reportedBy}
                    </Typography>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {report.apartment}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Categoría: {report.category}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {report.description}
                      </Typography>
                      {report.zone ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Zona reportada: {report.zone}
                        </Typography>
                      ) : null}
                      {(report.areaLabel || report.area) ? (
                        <Typography variant="body2" color="text.secondary">
                          Área afectada: {report.areaLabel || report.area}
                        </Typography>
                      ) : null}
                    </Box>
                    <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" onClick={() => handleOpenEditDialog(report)}>
                          Editar
                        </Button>
                        {report.status === 'open' ? (
                          <Button variant="text" size="small" onClick={() => handleMarkInProgress(report.id)}>
                            Marcar en proceso
                          </Button>
                        ) : null}
                        {report.status === 'in_progress' ? (
                          <Button variant="text" size="small" onClick={() => handleMarkPending(report.id)}>
                            Volver a pendiente
                          </Button>
                        ) : null}
                        {report.image ? (
                          <Button variant="text" size="small" onClick={() => handleOpenImagePreview(report)}>
                            Ver foto
                          </Button>
                        ) : null}
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleOpenResolveDialog(report.id)}
                          disabled={report.status === 'resolved'}
                        >
                          {report.status === 'resolved' ? 'Ya resuelto' : 'Marcar como resuelto'}
                        </Button>
                      </Stack>
                      {report.technician && (
                        <Typography variant="body2" color="text.secondary">
                          Técnico asignado: {report.technician}
                        </Typography>
                      )}
                      {report.resolvedAt && (
                        <Typography variant="body2" color="text.secondary">
                          Resuelto: {formatDate(report.resolvedAt)}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>

                  {report.resolutionNote && (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Nota de resolución
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {report.resolutionNote}
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      <Dialog open={imagePreview.open} onClose={handleCloseImagePreview} fullWidth maxWidth="md">
        <DialogTitle>Fotografía del reporte</DialogTitle>
        <DialogContent>
          {imagePreview.src ? (
            <Box
              component="img"
              src={imagePreview.src}
              alt={imagePreview.alt}
              sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 2 }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No se pudo cargar la imagen del reporte.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImagePreview}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resolveDialog.open} onClose={handleCloseResolveDialog} fullWidth maxWidth="sm">
        <DialogTitle>Confirmar resolución</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe brevemente qué trabajo se realizó para solucionar el reporte. Esta información quedará registrada para seguimiento.
          </Typography>
          <TextField
            label="Nota de resolución"
            multiline
            minRows={3}
            fullWidth
            value={resolveDialog.note}
            onChange={handleChangeNote}
            placeholder="Ejemplo: Se cambió la bisagra y se lubricó el mecanismo."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResolveDialog}>Cancelar</Button>
          <Button
            onClick={handleConfirmResolve}
            variant="contained"
            disabled={!resolveDialog.reportId}
          >
            Confirmar resolución
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog.open} onClose={handleCloseEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Editar reporte</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Categoría"
              value={editDialog.category}
              onChange={handleEditFieldChange('category')}
              fullWidth
            >
              {MTTO_CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Prioridad"
              value={editDialog.priority}
              onChange={handleEditFieldChange('priority')}
              fullWidth
            >
              {MTTO_PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancelar</Button>
          <Button
            onClick={handleConfirmEdit}
            variant="contained"
            disabled={!editDialog.reportId || !editDialog.category || !editDialog.priority}
          >
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearResolvedDialogOpen}
        onClose={handleCloseClearResolvedDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Limpiar reportes resueltos</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se eliminarán {totals.resolved} reportes marcados como resueltos. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClearResolvedDialog} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmClearResolved}
            variant="contained"
            color="error"
            disabled={totals.resolved === 0}
          >
            Limpiar ahora
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MTTOReportes;

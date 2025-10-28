import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Hotel as HotelIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  MeetingRoom as MeetingRoomIcon,
  History as HistoryIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import moment from 'moment';
import 'moment/locale/es';
import { colaboradoresAPI, dashboardAPI, handleAPIError } from '../services/api';
import { io } from 'socket.io-client';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

moment.locale('es');

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL
  || process.env.REACT_APP_API_URL
  || 'http://localhost:3001';
const SOCKET_ENABLED = (process.env.REACT_APP_ENABLE_SOCKET || '').toLowerCase() === 'true';

const Dashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeData, setRealtimeData] = useState({});
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false);
  const [movementFilters, setMovementFilters] = useState({ from: '', to: '' });
  const [movementResults, setMovementResults] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementClearing, setMovementClearing] = useState(false);
  const [movementError, setMovementError] = useState(null);
  const [movementInitialized, setMovementInitialized] = useState(false);

  const occupancyChartRef = useRef(null);
  const occupancyByPalaceChartRef = useRef(null);
  const occupancyByDepartmentChartRef = useRef(null);
  const occupancyByPositionChartRef = useRef(null);

  useEffect(() => {
    // Load initial dashboard data
    loadDashboardData();

    if (!SOCKET_ENABLED) {
      return undefined;
    }

    // Setup Socket.IO listeners for real-time updates when enabled on the backend
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socket.on('dashboard-update', (data) => {
      setRealtimeData(prevData => ({
        ...prevData,
        ...data
      }));
    });

    socket.on('new-reservation', (reservation) => {
      setRealtimeData(prevData => ({
        ...prevData,
        nuevaReserva: reservation,
        totalReservas: (prevData.totalReservas || 0) + 1
      }));
    });

    socket.on('occupancy-update', (occupancyData) => {
      setRealtimeData(prevData => ({
        ...prevData,
        ocupacion: occupancyData
      }));
    });

    return () => {
      socket.off('dashboard-update');
      socket.off('new-reservation');
      socket.off('occupancy-update');
      socket.disconnect();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await dashboardAPI.getOverview();
      setDashboardData(data);
    } catch (err) {
      const errorMessage = handleAPIError(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getMovementTypeLabel = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'assignment':
        return 'Asignación';
      case 'unassignment':
        return 'Desasignación';
      case 'retire':
        return 'Retiro';
      case 'registration':
        return 'Registro';
      default:
        return 'Movimiento';
    }
  };

  const getMovementChipColor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'assignment':
        return 'primary';
      case 'unassignment':
        return 'warning';
      case 'retire':
        return 'error';
      case 'registration':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatMovementLocation = (movement) => {
    const segments = [movement.palaceName, movement.floorName, movement.apartmentName, movement.roomName]
      .filter(Boolean)
      .map((value) => value.trim());
    return segments.length > 0 ? segments.join(' • ') : movement.note || '';
  };

  const formatMovementTimestamp = (value) => {
    if (!value) {
      return 'Hace instantes';
    }
    const instance = moment(value);
    if (!instance.isValid()) {
      return 'Hace instantes';
    }
    const relative = instance.fromNow();
    return relative.charAt(0).toUpperCase() + relative.slice(1);
  };

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const normalizeMovementFilters = (filters) => {
    const params = {};
    if (filters.from) {
      params.from = filters.from;
    }
    if (filters.to) {
      params.to = filters.to;
    }
    return params;
  };

  const fetchMovements = async (filters = movementFilters) => {
    try {
      setMovementLoading(true);
      setMovementError(null);
      const params = normalizeMovementFilters(filters);
      const { data } = await colaboradoresAPI.getMovimientos(params);
      setMovementResults(data?.movimientos ?? []);
    } catch (err) {
      setMovementError(handleAPIError(err));
    } finally {
      setMovementLoading(false);
    }
  };

  const handleOpenMovementsDialog = () => {
    setMovementsDialogOpen(true);
    setMovementResults(currentData.movimientosColaboradores || []);
    if (!movementInitialized) {
      fetchMovements({ from: '', to: '' });
      setMovementInitialized(true);
    }
  };

  const handleCloseMovementsDialog = () => {
    if (movementLoading) {
      return;
    }
    setMovementsDialogOpen(false);
  };

  const handleMovementFilterChange = (field) => (event) => {
    const { value } = event.target;
    setMovementFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMovementSearch = () => {
    fetchMovements(movementFilters);
  };

  const handleMovementReset = () => {
    const defaults = { from: '', to: '' };
    setMovementFilters(defaults);
    fetchMovements(defaults);
  };

  const handleMovementClearHistory = async () => {
    if (movementLoading || movementClearing) {
      return;
    }

    try {
      setMovementClearing(true);
      setMovementError(null);
      await colaboradoresAPI.clearMovimientos();
      const defaults = { from: '', to: '' };
      setMovementFilters(defaults);
      setMovementResults([]);
      setDashboardData((prev) => (prev ? { ...prev, movimientosColaboradores: [] } : prev));
      setRealtimeData((prev) => ({ ...prev, movimientosColaboradores: [] }));
    } catch (err) {
      setMovementError(handleAPIError(err));
    } finally {
      setMovementClearing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Loading skeletons */}
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Paper sx={{ p: 2 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rectangular" height={40} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <IconButton color="inherit" size="small" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No hay datos disponibles</Alert>
      </Box>
    );
  }

  // Merge real-time data with dashboard data
  const currentData = {
    ...dashboardData,
    ...realtimeData
  };

  const alerts = (currentData.alertas || [])
    .slice()
    .sort((a, b) => {
      const dateA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA;
    });

  const recentMovements = (currentData.movimientosColaboradores || []).slice(0, 5);

  const handleAlertNavigation = (alertItem) => {
    if (!alertItem || !alertItem.roomId) {
      return;
    }

    navigate('/alojamientos', {
      state: {
        focusPalaceId: alertItem.palaceId,
        focusFloorId: alertItem.floorId,
        focusApartmentId: alertItem.apartmentId,
        focusRoomId: alertItem.roomId,
        focusToken: Date.now()
      }
    });
  };

  // KPI Cards Data
  const kpiCards = [
    {
      title: 'Ocupación actual',
      value: `${currentData.ocupacionPorcentaje || 0}%`,
      subtitle: `${currentData.unidadesOcupadas || 0}/${currentData.totalUnidades || 0} habitaciones ocupadas`,
      icon: HotelIcon,
      color: '#1976d2',
      trend: currentData.tendenciaOcupacion || '+5.2%'
    },
    {
      title: 'Habitaciones disponibles',
      value: currentData.unidadesDisponibles || 0,
      subtitle: `${currentData.totalUnidades || 0} totales`,
      icon: MeetingRoomIcon,
      color: '#4caf50',
      trend: `${currentData.unidadesMantenimiento || 0} en mantenimiento | ${currentData.apartamentosFueraServicio || 0} aptos fuera de servicio`
    },
    {
      title: 'Huéspedes alojados',
      value: currentData.huespedesActuales || 0,
      subtitle: `Capacidad: ${currentData.capacidadTotal || 0}`,
      icon: PeopleIcon,
      color: '#2e7d32',
      trend: `${currentData.huespedesDisponibles || 0} plazas libres`
    },
    {
      title: 'Movimientos de hoy',
      value: `${Number(currentData.ingresosDiarios ?? 0).toLocaleString()} ingresos`,
      subtitle: `${Number(currentData.retirosHoy ?? currentData.checkinsCompletados ?? 0).toLocaleString()} salidas / retiros`,
      icon: HistoryIcon,
      color: '#8e24aa',
      trend: `${currentData.tendenciaIngresos || ''}`.trim() || 'Actividad registrada'
    }
  ];

  // Chart data for occupancy
  const occupancyData = {
    labels: ['Ocupadas', 'Disponibles', 'Mantenimiento'],
    datasets: [
      {
        data: [
          currentData.unidadesOcupadas || 0,
          currentData.unidadesDisponibles || 0,
          currentData.unidadesMantenimiento || 0
        ],
        backgroundColor: [
          '#1976d2',
          '#4caf50',
          '#ff9800'
        ],
        borderWidth: 2
      }
    ]
  };

  const palaceOccupancy = currentData.ocupacionPorPalace || [];

  const occupancyByPalaceData = {
    labels: palaceOccupancy.length > 0 ? palaceOccupancy.map((item) => item.name) : ['Sin datos'],
    datasets: palaceOccupancy.length > 0 ? [
      {
        label: 'Habitaciones ocupadas',
        data: palaceOccupancy.map((item) => item.roomsOccupied || 0),
        backgroundColor: '#1976d2'
      },
      {
        label: 'Disponibles',
        data: palaceOccupancy.map((item) => item.roomsAvailable || 0),
        backgroundColor: '#4caf50'
      },
      {
  label: 'Mantenimiento',
        data: palaceOccupancy.map((item) => (item.roomsMaintenance || 0) + (item.roomsCleaning || 0)),
        backgroundColor: '#ffb74d'
      }
    ] : [
      {
        label: 'Sin información',
        data: [1],
        backgroundColor: '#e0e0e0'
      }
    ]
  };

  const occupancyByDepartment = currentData.ocupacionPorDepartamento || [];
  const occupancyByPosition = currentData.ocupacionPorPosicion || [];

  const occupancyByDepartmentData = occupancyByDepartment.length > 0
    ? {
        labels: occupancyByDepartment.map((item) => item.department || 'Sin definir'),
        datasets: [
          {
            label: 'Habitaciones ocupadas',
            data: occupancyByDepartment.map((item) => item.roomsAssigned || 0),
            backgroundColor: '#1976d2'
          },
          {
            label: 'Colaboradores activos',
            data: occupancyByDepartment.map((item) => item.activeCollaborators || 0),
            backgroundColor: '#4caf50'
          }
        ]
      }
    : {
        labels: ['Sin datos'],
        datasets: [
          {
            label: 'Sin información',
            data: [1],
            backgroundColor: '#e0e0e0'
          }
        ]
      };

  const occupancyByPositionData = occupancyByPosition.length > 0
    ? {
        labels: occupancyByPosition.map((item) => item.position || 'Sin definir'),
        datasets: [
          {
            label: 'Habitaciones ocupadas',
            data: occupancyByPosition.map((item) => item.roomsAssigned || 0),
            backgroundColor: '#1976d2'
          },
          {
            label: 'Colaboradores activos',
            data: occupancyByPosition.map((item) => item.activeCollaborators || 0),
            backgroundColor: '#4caf50'
          }
        ]
      }
    : {
        labels: ['Sin datos'],
        datasets: [
          {
            label: 'Sin información',
            data: [1],
            backgroundColor: '#e0e0e0'
          }
        ]
      };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    scales: {
      x: {
        stacked: true
      },
      y: {
        stacked: true,
        beginAtZero: true
      }
    }
  };

  const comparisonBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    scales: {
      x: {
        stacked: false
      },
      y: {
        beginAtZero: true
      }
    }
  };

  const handlePrintGeneralReport = () => {
    const printWindow = window.open('', '', 'width=1024,height=768');
    if (!printWindow) {
      window.alert('No se pudo abrir la ventana de impresión. Verifica los bloqueadores emergentes.');
      return;
    }

    const generatedAt = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date());

    const toNumber = (value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const formatNumber = (value) => {
      return toNumber(value).toLocaleString('es-ES');
    };

    const formatPercent = (value) => {
      if (value === null || value === undefined || value === '') {
        return 'N/D';
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return String(value);
      }
      return `${numeric.toFixed(1)}%`;
    };

    const chartImages = {
      general: occupancyChartRef.current?.toBase64Image?.(),
      palace: occupancyByPalaceChartRef.current?.toBase64Image?.(),
      department: occupancyByDepartmentChartRef.current?.toBase64Image?.(),
      position: occupancyByPositionChartRef.current?.toBase64Image?.()
    };

    const palaceRows = palaceOccupancy.length > 0
      ? palaceOccupancy.map((item) => {
          const occupied = toNumber(item.roomsOccupied);
          const available = toNumber(item.roomsAvailable);
          const maintenance = toNumber(item.roomsMaintenance) + toNumber(item.roomsCleaning);
          const total = occupied + available + maintenance;
          const rate = total > 0 ? `${((occupied / total) * 100).toFixed(1)}%` : 'N/D';
          return `
            <tr>
              <td>${escapeHtml(item.name || 'Sin nombre')}</td>
              <td>${escapeHtml(formatNumber(occupied))}</td>
              <td>${escapeHtml(formatNumber(available))}</td>
              <td>${escapeHtml(formatNumber(maintenance))}</td>
              <td>${escapeHtml(rate)}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="5">Sin datos disponibles</td></tr>';

    const departmentRows = occupancyByDepartment.length > 0
      ? occupancyByDepartment.map((item) => {
          const assigned = toNumber(item.roomsAssigned);
          const active = toNumber(item.activeCollaborators);
          const available = toNumber(item.roomsAvailable ?? item.availableRooms);
          return `
            <tr>
              <td>${escapeHtml(item.department || 'Sin definir')}</td>
              <td>${escapeHtml(formatNumber(assigned))}</td>
              <td>${escapeHtml(formatNumber(active))}</td>
              <td>${escapeHtml(formatNumber(available))}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4">Sin datos disponibles</td></tr>';

    const positionRows = occupancyByPosition.length > 0
      ? occupancyByPosition.map((item) => {
          const assigned = toNumber(item.roomsAssigned);
          const active = toNumber(item.activeCollaborators);
          const available = toNumber(item.roomsAvailable ?? item.availableRooms);
          return `
            <tr>
              <td>${escapeHtml(item.position || 'Sin definir')}</td>
              <td>${escapeHtml(formatNumber(assigned))}</td>
              <td>${escapeHtml(formatNumber(active))}</td>
              <td>${escapeHtml(formatNumber(available))}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4">Sin datos disponibles</td></tr>';

    const summaryItems = [
      { label: 'Tasa de ocupación', value: formatPercent(currentData.ocupacionPorcentaje) },
      { label: 'Habitaciones ocupadas', value: formatNumber(currentData.unidadesOcupadas) },
      { label: 'Habitaciones disponibles', value: formatNumber(currentData.unidadesDisponibles) },
      { label: 'En mantenimiento', value: formatNumber(currentData.unidadesMantenimiento) },
      { label: 'Total de habitaciones', value: formatNumber(currentData.totalUnidades) },
      { label: 'Colaboradores activos', value: formatNumber(currentData.colaboradoresActivos) },
      { label: 'Capacidad total', value: formatNumber(currentData.capacidadTotal) }
    ];

    const summaryRows = summaryItems
      .map((item) => `
        <tr>
          <th>${escapeHtml(item.label)}</th>
          <td>${escapeHtml(item.value)}</td>
        </tr>
      `)
      .join('');

    const chartsSection = [
      { key: 'general', title: 'Estado de habitaciones' },
      { key: 'palace', title: 'Ocupación por edificio' },
      { key: 'department', title: 'Ocupación por departamento' },
      { key: 'position', title: 'Ocupación por posición' }
    ]
      .map(({ key, title }) => {
        const image = chartImages[key];
        if (!image) {
          return `
            <div class="chart">
              <h3>${escapeHtml(title)}</h3>
              <p>Gráfico no disponible.</p>
            </div>
          `;
        }
        return `
          <div class="chart">
            <h3>${escapeHtml(title)}</h3>
            <img src="${image}" alt="${escapeHtml(title)}" />
          </div>
        `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charSet="utf-8" />
          <title>Reporte general de ocupación y disponibilidad</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            h2 { font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; }
            h3 { font-size: 16px; margin: 8px 0; }
            p.meta { color: #6b7280; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 13px; text-align: left; }
            th { background-color: #f3f4f6; }
            .summary-table th { width: 60%; }
            .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
            .chart { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .chart img { width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <h1>Reporte general de ocupación y disponibilidad</h1>
          <p class="meta">Generado ${escapeHtml(generatedAt)}</p>

          <h2>Resumen ejecutivo</h2>
          <table class="summary-table">
            <tbody>
              ${summaryRows}
            </tbody>
          </table>

          <h2>Visualizaciones</h2>
          <div class="chart-grid">
            ${chartsSection}
          </div>

          <h2>Ocupación y disponibilidad por edificio</h2>
          <table>
            <thead>
              <tr>
                <th>Edificio</th>
                <th>Habitaciones ocupadas</th>
                <th>Habitaciones disponibles</th>
                <th>En mantenimiento</th>
                <th>% Ocupación</th>
              </tr>
            </thead>
            <tbody>
              ${palaceRows}
            </tbody>
          </table>

          <h2>Ocupación por departamento</h2>
          <table>
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Habitaciones ocupadas</th>
                <th>Colaboradores activos</th>
                <th>Habitaciones disponibles</th>
              </tr>
            </thead>
            <tbody>
              ${departmentRows}
            </tbody>
          </table>

          <h2>Ocupación por posición</h2>
          <table>
            <thead>
              <tr>
                <th>Posición</th>
                <th>Habitaciones ocupadas</th>
                <th>Colaboradores activos</th>
                <th>Habitaciones disponibles</th>
              </tr>
            </thead>
            <tbody>
              ${positionRows}
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon fontSize="large" />
          Dashboard Principal
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintGeneralReport}
            disabled={loading}
          >
            Imprimir reporte general
          </Button>
        </Stack>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {kpiCards.map((kpi, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: `${kpi.color}20`,
                      mr: 2
                    }}
                  >
                    <kpi.icon sx={{ color: kpi.color, fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {kpi.title}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {kpi.subtitle}
                </Typography>
                <Chip
                  label={kpi.trend}
                  size="small"
                  color={kpi.trend.includes('+') ? 'success' : 'default'}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Occupancy Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Estado de Habitaciones
            </Typography>
            <Box sx={{ height: 300 }}>
              <Doughnut ref={occupancyChartRef} data={occupancyData} options={chartOptions} />
            </Box>
          </Paper>
        </Grid>

        {/* Occupancy by Palace */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ocupación por edificio PALACE
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar ref={occupancyByPalaceChartRef} data={occupancyByPalaceData} options={barOptions} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ocupación por departamento
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar ref={occupancyByDepartmentChartRef} data={occupancyByDepartmentData} options={comparisonBarOptions} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ocupación por posición
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar ref={occupancyByPositionChartRef} data={occupancyByPositionData} options={comparisonBarOptions} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activities & Alerts */}
      <Grid container spacing={3}>
        {/* Collaborator Movements */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon />
                Movimientos de colaboradores
              </Typography>
              <Button
                variant="text"
                size="small"
                startIcon={<HistoryIcon />}
                onClick={handleOpenMovementsDialog}
              >
                Historial
              </Button>
            </Box>
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <Box key={`${movement.id}-${movement.timestamp}`} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {movement.collaboratorNombre || 'Colaborador'}
                    {movement.collaboratorCodigo ? ` (${movement.collaboratorCodigo})` : ''}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ my: 0.5 }}>
                    <Chip size="small" label={getMovementTypeLabel(movement.type)} color={getMovementChipColor(movement.type)} />
                    {movement.department && (
                      <Chip size="small" label={movement.department} variant="outlined" />
                    )}
                    {movement.position && (
                      <Chip size="small" label={movement.position} variant="outlined" />
                    )}
                  </Stack>
                  {formatMovementLocation(movement) && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatMovementLocation(movement)}
                    </Typography>
                  )}
                  {movement.note && (
                    <Typography variant="body2">
                      {movement.note}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {formatMovementTimestamp(movement.timestamp)}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No hay movimientos recientes de colaboradores.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Alerts & Notifications */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon />
              Alertas y Notificaciones
            </Typography>
            {alerts.length > 0 ? (
              alerts.map((alerta) => {
                const momentInstance = alerta.timestamp ? moment(alerta.timestamp) : null;
                const relativeTime = momentInstance && momentInstance.isValid()
                  ? momentInstance.fromNow()
                  : 'hace instantes';
                const relativeTimeLabel = relativeTime.charAt(0).toUpperCase() + relativeTime.slice(1);
                const locationParts = [alerta.roomName, alerta.apartmentName, alerta.floorName, alerta.palaceName].filter(Boolean);
                const locationText = locationParts.join(' • ');
                const baseMessage = alerta.mensaje;
                const noteText = alerta.nota;

                return (
                  <Alert
                    key={alerta.id || `${alerta.roomId || 'alert'}-${alerta.timestamp || relativeTime}`}
                    severity={alerta.tipo || 'warning'}
                    sx={{ mb: 1 }}
                    action={alerta.roomId ? (
                      <Button color="inherit" size="small" onClick={() => handleAlertNavigation(alerta)}>
                        Ver
                      </Button>
                    ) : null}
                  >
                    {locationText && (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {locationText}
                      </Typography>
                    )}
                    {baseMessage && (
                      <Typography variant="body2">
                        {baseMessage}
                      </Typography>
                    )}
                    {noteText && (
                      <Typography variant="body2" color="text.secondary">
                        {noteText}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {relativeTimeLabel}
                    </Typography>
                  </Alert>
                );
              })
            ) : (
              <Typography variant="body2" color="text.secondary">
                No hay alertas activas
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={movementsDialogOpen} onClose={handleCloseMovementsDialog} fullWidth maxWidth="md">
        <DialogTitle>Historial de movimientos de colaboradores</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
              <TextField
                label="Desde"
                type="date"
                value={movementFilters.from}
                onChange={handleMovementFilterChange('from')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Hasta"
                type="date"
                value={movementFilters.to}
                onChange={handleMovementFilterChange('to')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleMovementSearch}
                  disabled={movementLoading || movementClearing}
                >
                  Buscar
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleMovementReset}
                  disabled={movementLoading || movementClearing || (!movementFilters.from && !movementFilters.to)}
                >
                  Reiniciar filtros
                </Button>
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={handleMovementClearHistory}
                  disabled={movementLoading || movementClearing}
                >
                  Limpiar historial
                </Button>
              </Stack>
            </Stack>

            {movementError && (
              <Alert severity="error" onClose={() => setMovementError(null)}>
                {movementError}
              </Alert>
            )}

            {movementLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : movementResults.length > 0 ? (
              <List disablePadding>
                {movementResults.map((movement) => (
                  <ListItem key={`${movement.id}-${movement.timestamp}`} sx={{ display: 'block', borderBottom: '1px solid #eee', py: 1.5 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {movement.collaboratorNombre || 'Colaborador'}
                          {movement.collaboratorCodigo ? ` (${movement.collaboratorCodigo})` : ''}
                        </Typography>
                        <Chip size="small" label={getMovementTypeLabel(movement.type)} color={getMovementChipColor(movement.type)} />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        {movement.department && <Chip size="small" label={movement.department} variant="outlined" />}
                        {movement.position && <Chip size="small" label={movement.position} variant="outlined" />}
                      </Stack>
                      {formatMovementLocation(movement) && (
                        <Typography variant="caption" color="text.secondary">
                          {formatMovementLocation(movement)}
                        </Typography>
                      )}
                      {movement.note && (
                        <Typography variant="body2">
                          {movement.note}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatMovementTimestamp(movement.timestamp)}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No se encontraron movimientos en el rango seleccionado.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMovementsDialog} disabled={movementLoading}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Real-time updates indicator */}
      {Object.keys(realtimeData).length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
          <Chip
            icon={<CheckCircleIcon />}
            label="Datos actualizados en tiempo real"
            color="success"
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
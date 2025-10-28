import React, { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessIcon from '@mui/icons-material/Business';
import LayersIcon from '@mui/icons-material/Layers';
import PeopleIcon from '@mui/icons-material/People';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PrintIcon from '@mui/icons-material/Print';
import { useNavigate } from 'react-router-dom';
import { alojamientosAPI, handleAPIError } from '../services/api';
import DateRangeIcon from '@mui/icons-material/DateRange';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ClearIcon from '@mui/icons-material/Clear';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { usePalaces } from '../hooks/usePalaces';
import { escapeHTML } from '../utils/escape';
import { MAX_COLLABORATORS_PER_ROOM } from './mttoConstants';

const formatTimestamp = (value) => {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(value);
  } catch (err) {
    console.warn('No se pudo formatear la fecha de actualización', err);
    return null;
  }
};

const Disponibilidad = () => {
  const navigate = useNavigate();
  const {
    palaces,
    loading,
    error,
    lastUpdated,
    refresh: refreshPalaces
  } = usePalaces();
  const [actionPending, setActionPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [preCheckinDialog, setPreCheckinDialog] = useState({
    open: false,
    room: null,
    guestName: '',
    checkinDate: '',
    notes: ''
  });

  const availabilityByPalace = useMemo(() => {
    return palaces.map((palace) => {
      const availableRooms = [];
      const preCheckinRooms = [];
      let fallbackRoom = null;
      let apartmentCount = 0;
      let activeRoomCount = 0;

      palace.floors?.forEach((floor) => {
        floor.apartments?.forEach((apartment) => {
          if (apartment.status === 'out_of_service') {
            return;
          }

          apartmentCount += 1;

          apartment.rooms?.forEach((room) => {
            activeRoomCount += 1;

            if (!fallbackRoom) {
              fallbackRoom = {
                palaceId: palace.id,
                palaceName: palace.name,
                floorId: floor.id,
                floorName: floor.name,
                apartmentId: apartment.id,
                apartmentName: apartment.name,
                roomId: room.id,
                roomName: room.name,
                availableSlots: 0
              };
            }

            if (room.status === 'maintenance' || room.status === 'cleaning') {
              return;
            }

            const preCheckin = room.preCheckin || null;
            if (preCheckin) {
              preCheckinRooms.push({
                palaceId: palace.id,
                palaceName: palace.name,
                floorId: floor.id,
                floorName: floor.name,
                apartmentId: apartment.id,
                apartmentName: apartment.name,
                roomId: room.id,
                roomName: room.name,
                preCheckin
              });
            }

            const collaboratorIds = new Set();

            if (Array.isArray(room.collaboratorIds)) {
              room.collaboratorIds.filter(Boolean).forEach((id) => {
                collaboratorIds.add(id);
              });
            }

            if (Array.isArray(room.collaborators)) {
              room.collaborators.forEach((collaborator) => {
                if (collaborator?.id) {
                  collaboratorIds.add(collaborator.id);
                }
              });
            }

            const usedSlots = Math.min(
              MAX_COLLABORATORS_PER_ROOM,
              collaboratorIds.size + (preCheckin ? 1 : 0)
            );
            const availableSlots = Math.max(MAX_COLLABORATORS_PER_ROOM - usedSlots, 0);

            if (availableSlots <= 0) {
              return;
            }

            availableRooms.push({
              palaceId: palace.id,
              palaceName: palace.name,
              floorId: floor.id,
              floorName: floor.name,
              apartmentId: apartment.id,
              apartmentName: apartment.name,
              roomId: room.id,
              roomName: room.name,
              availableSlots,
              preCheckin
            });
          });
        });
      });

      const totalSlots = availableRooms.reduce((acc, room) => acc + room.availableSlots, 0);

      preCheckinRooms.sort((a, b) => {
        const dateA = a.preCheckin?.checkinDate ? new Date(a.preCheckin.checkinDate).getTime() : Number.POSITIVE_INFINITY;
        const dateB = b.preCheckin?.checkinDate ? new Date(b.preCheckin.checkinDate).getTime() : Number.POSITIVE_INFINITY;
        return dateA - dateB;
      });

      availableRooms.sort((a, b) => {
        if (a.apartmentName && b.apartmentName && a.apartmentName !== b.apartmentName) {
          return a.apartmentName.localeCompare(b.apartmentName);
        }
        if (a.floorName && b.floorName && a.floorName !== b.floorName) {
          return a.floorName.localeCompare(b.floorName);
        }
        return (a.roomName || '').localeCompare(b.roomName || '');
      });

      return {
        palaceId: palace.id,
  palaceName: palace.name || `Edificio ${palace.seriesNumber ?? ''}`,
        floorCount: palace.floors?.length ?? 0,
        apartmentCount,
        activeRoomCount,
        availableRooms,
        availableRoomCount: availableRooms.length,
        availableSlots: totalSlots,
        fallbackRoom: availableRooms[0] || fallbackRoom,
        preCheckinRooms
      };
    });
  }, [palaces]);

  const totals = useMemo(() => {
    return availabilityByPalace.reduce(
      (acc, item) => {
        acc.rooms += item.availableRoomCount;
        acc.slots += item.availableSlots;
        return acc;
      },
      { rooms: 0, slots: 0 }
    );
  }, [availabilityByPalace]);

  const handlePrintAvailabilityReport = () => {
    if (availabilityByPalace.length === 0) {
      setStatusMessage({ type: 'error', message: 'No hay datos de disponibilidad para imprimir.' });
      return;
    }

  const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setStatusMessage({
        type: 'error',
        message: 'No se pudo abrir la vista de impresión. Habilita las ventanas emergentes e inténtalo de nuevo.'
      });
      return;
    }

    const generatedAt = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date());

    const sections = availabilityByPalace
      .map((palace) => {
        const safePalaceName = escapeHTML(palace.palaceName);
        const roomsTable = palace.availableRooms.length
          ? `
            <table>
              <thead>
                <tr>
                  <th>Habitación</th>
                  <th>Apartamento</th>
                  <th>Piso</th>
                  <th>Cupos libres</th>
                  <th>Pre-ingreso</th>
                </tr>
              </thead>
              <tbody>
                ${palace.availableRooms
                  .map((room) => {
                    const preCheckinLabel = room.preCheckin?.checkinDate
                      ? new Intl.DateTimeFormat('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        }).format(new Date(room.preCheckin.checkinDate))
                      : 'Sin pre-ingreso programado';
                    const preCheckinBlocks = [];

                    if (room.preCheckin?.checkinDate) {
                      preCheckinBlocks.push(
                        `<div><strong>Ingreso:</strong> ${escapeHTML(preCheckinLabel)}</div>`
                      );
                    }

                    if (room.preCheckin?.guestName) {
                      preCheckinBlocks.push(
                        `<div><strong>Huésped:</strong> ${escapeHTML(room.preCheckin.guestName)}</div>`
                      );
                    }

                    if (room.preCheckin?.notes) {
                      preCheckinBlocks.push(
                        `<div><strong>Notas:</strong> ${escapeHTML(room.preCheckin.notes)}</div>`
                      );
                    }

                    const preCheckinContent = preCheckinBlocks.length
                      ? preCheckinBlocks.join('')
                      : '<div>Sin pre-ingreso programado</div>';
                    return `
                      <tr>
                        <td>${escapeHTML(room.roomName || 'Habitación sin nombre')}</td>
                        <td>${escapeHTML(room.apartmentName || 'Apartamento sin nombre')}</td>
                        <td>${escapeHTML(room.floorName || 'Piso sin nombre')}</td>
                        <td>${escapeHTML(room.availableSlots)}</td>
                        <td>${preCheckinContent}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : '<p class="empty">No hay habitaciones con cupos disponibles en este edificio.</p>';

        return `
          <section>
            <h2>${safePalaceName}</h2>
            <div class="metrics">
              <div><strong>Habitaciones disponibles:</strong> ${escapeHTML(palace.availableRoomCount)}</div>
              <div><strong>Cupos libres:</strong> ${escapeHTML(palace.availableSlots)}</div>
              <div><strong>Pisos:</strong> ${escapeHTML(palace.floorCount)}</div>
              <div><strong>Apartamentos activos:</strong> ${escapeHTML(palace.apartmentCount)}</div>
            </div>
            ${roomsTable}
          </section>
        `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Reporte de habitaciones disponibles</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; padding: 24px; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 32px; margin-bottom: 12px; }
            p { margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d0d7de; padding: 8px 10px; text-align: left; }
            th { background-color: #f6f8fa; }
            .summary { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
            .summary div { background: #eef2ff; padding: 10px 14px; border-radius: 6px; font-weight: 600; }
            .metrics { display: flex; gap: 12px; flex-wrap: wrap; font-size: 14px; }
            .metrics div { background: #f8fafc; padding: 8px 12px; border-radius: 6px; }
            .empty { font-style: italic; color: #6b7280; }
            @media print { body { padding: 0; } .summary div, .metrics div { border: 1px solid #d0d7de; } }
          </style>
        </head>
        <body>
          <h1>Reporte de habitaciones disponibles</h1>
          <p>Generado el ${generatedAt}</p>
          <div class="summary">
            <div>Total edificios con disponibilidad: ${escapeHTML(availabilityByPalace.length)}</div>
            <div>Total habitaciones disponibles: ${escapeHTML(totals.rooms)}</div>
            <div>Total cupos libres: ${escapeHTML(totals.slots)}</div>
          </div>
          ${sections}
          <script>
            (function() {
              const triggerPrint = () => {
                if (window.__availabilityReportPrintTriggered) {
                  return;
                }
                window.__availabilityReportPrintTriggered = true;
                setTimeout(() => {
                  try {
                    window.focus();
                    window.print();
                  } catch (error) {
                    console.error('Error al imprimir el reporte de disponibilidad dentro de la ventana de impresión', error);
                  }
                }, 120);
              };

              if (document.readyState === 'complete') {
                triggerPrint();
              } else {
                window.addEventListener('load', triggerPrint, { once: true });
              }
            })();
          </script>
        </body>
      </html>
    `;

    try {
      printWindow.document.open('text/html', 'replace');
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (renderError) {
      console.error('No se pudo preparar el contenido del reporte de disponibilidad para impresión', renderError);
      try {
        printWindow.close();
      } catch (closeError) {
        console.warn('No se pudo cerrar la ventana de impresión luego de un error', closeError);
      }
      setStatusMessage({
        type: 'error',
        message: 'No se pudo preparar el reporte para impresión. Intenta nuevamente.'
      });
      return;
    }

    const fallbackDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    setTimeout(() => {
      try {
        if (printWindow.closed) {
          return;
        }

        const hasContent = Boolean(printWindow.document?.body?.children?.length);

        if (!hasContent) {
          printWindow.location.replace(fallbackDataUrl);
        }
      } catch (contentError) {
        console.warn('No se pudo verificar el contenido de la ventana de impresión, aplicando fallback', contentError);
        try {
          if (!printWindow.closed) {
            printWindow.location.replace(fallbackDataUrl);
          }
        } catch (fallbackError) {
          console.error('No se pudo aplicar el fallback para la ventana de impresión', fallbackError);
        }
      }
    }, 200);

    const ensureFocus = () => {
      try {
        if (!printWindow.closed) {
          printWindow.focus();
        }
      } catch (focusError) {
        console.warn('No se pudo enfocar la ventana de impresión', focusError);
      }
    };

    setTimeout(ensureFocus, 200);
  };

  const handleViewBuilding = (palace) => {
    const targetRoom = palace.fallbackRoom;

    navigate('/alojamientos', {
      state: targetRoom
        ? {
            focusPalaceId: targetRoom.palaceId,
            focusFloorId: targetRoom.floorId,
            focusApartmentId: targetRoom.apartmentId,
            focusRoomId: targetRoom.roomId,
            focusToken: `disponibilidad-palace-${targetRoom.palaceId}-${targetRoom.roomId}-${Date.now()}`
          }
        : {
            focusPalaceId: palace.palaceId,
            focusToken: `disponibilidad-palace-${palace.palaceId}-${Date.now()}`
          }
    });
  };

  const handleViewRoom = (room) => {
    navigate('/alojamientos', {
      state: {
        focusPalaceId: room.palaceId,
        focusFloorId: room.floorId,
        focusApartmentId: room.apartmentId,
        focusRoomId: room.roomId,
        focusToken: `disponibilidad-room-${room.roomId}-${Date.now()}`
      }
    });
  };

  const handleOpenPreCheckinDialog = (room, existingPreCheckin = null) => {
    if (!room) {
      return;
    }

    setPreCheckinDialog({
      open: true,
      room,
      guestName: existingPreCheckin?.guestName || '',
      checkinDate: existingPreCheckin?.checkinDate
        ? new Date(existingPreCheckin.checkinDate).toISOString().slice(0, 16)
        : '',
      notes: existingPreCheckin?.notes || ''
    });
    setStatusMessage(null);
  };

  const handleClosePreCheckinDialog = () => {
    setPreCheckinDialog({ open: false, room: null, guestName: '', checkinDate: '', notes: '' });
  };

  const handleSubmitPreCheckin = async () => {
    const { room, guestName, checkinDate, notes } = preCheckinDialog;
    if (!room) {
      return;
    }

    if (!checkinDate) {
      setStatusMessage({ type: 'error', message: 'Selecciona la fecha y hora de ingreso.' });
      return;
    }

    const parsedDate = new Date(checkinDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setStatusMessage({ type: 'error', message: 'La fecha de ingreso no es válida.' });
      return;
    }

    const trimmedName = guestName.trim();
    const trimmedNotes = notes.trim();

    setActionPending(true);
    setStatusMessage(null);

    try {
      await alojamientosAPI.updateRoom(room.palaceId, room.roomId, {
        preCheckin: {
          guestName: trimmedName || null,
          checkinDate: parsedDate.toISOString(),
          notes: trimmedNotes
        }
      });
      handleClosePreCheckinDialog();
  await refreshPalaces();
      setStatusMessage({
        type: 'success',
        message: trimmedName ? `Pre-ingreso programado para ${trimmedName}.` : 'Pre-ingreso programado.'
      });
    } catch (err) {
      setStatusMessage({ type: 'error', message: handleAPIError(err) });
    } finally {
      setActionPending(false);
    }
  };

  const handleClearPreCheckin = async (room) => {
    if (!room) {
      return;
    }

    setActionPending(true);
    setStatusMessage(null);

    try {
      await alojamientosAPI.updateRoom(room.palaceId, room.roomId, { preCheckin: null });
  await refreshPalaces();
      setStatusMessage({ type: 'success', message: 'Pre-ingreso liberado.' });
    } catch (err) {
      setStatusMessage({ type: 'error', message: handleAPIError(err) });
    } finally {
      setActionPending(false);
    }
  };

  const formattedUpdatedAt = formatTimestamp(lastUpdated);
  const isInitialLoading = loading && palaces.length === 0;
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <Box sx={{ p: 4 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Disponibilidad de habitaciones
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Revisa los edificios con cupos libres y navega directo a la vista de alojamientos.
          </Typography>
          {formattedUpdatedAt && (
            <Typography variant="caption" color="text.secondary">
              Actualizado {formattedUpdatedAt}
            </Typography>
          )}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Chip
            icon={<MeetingRoomIcon />}
            color="success"
            variant="outlined"
            label={`${totals.rooms} habitaciones`}
          />
          <Chip
            icon={<PeopleIcon />}
            color="primary"
            variant="outlined"
            label={`${totals.slots} cupos libres`}
          />
          <Button
            startIcon={<RefreshIcon />}
            variant="contained"
            onClick={refreshPalaces}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            onClick={handlePrintAvailabilityReport}
            disabled={loading || availabilityByPalace.length === 0}
          >
            Imprimir reporte
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {statusMessage && (
        <Alert
          severity={statusMessage.type === 'error' ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setStatusMessage(null)}
        >
          {statusMessage.message}
        </Alert>
      )}

      {isInitialLoading ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="body1">Cargando disponibilidad…</Typography>
        </Paper>
      ) : availabilityByPalace.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            No hay edificios registrados.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea al menos un edificio en la sección de Alojamientos para revisar disponibilidad.
          </Typography>
        </Paper>
      ) : (
        availabilityByPalace.map((palace) => (
          <Paper key={palace.palaceId} sx={{ p: 3, mb: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <BusinessIcon color="primary" />
                <Box>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    {palace.palaceName}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<MeetingRoomIcon />}
                      label={`${palace.availableRoomCount} habitaciones disponibles`}
                      color={palace.availableRoomCount > 0 ? 'success' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      icon={<PeopleIcon />}
                      label={`${palace.availableSlots} cupos libres`}
                      color={palace.availableSlots > 0 ? 'primary' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      icon={<LayersIcon />}
                      label={`${palace.floorCount} pisos`}
                      variant="outlined"
                    />
                    <Chip
                      icon={<ApartmentIcon />}
                      label={`${palace.apartmentCount} apartamentos activos`}
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              </Stack>
              <Button
                variant="contained"
                endIcon={<ChevronRightIcon />}
                onClick={() => handleViewBuilding(palace)}
                disabled={!palace.fallbackRoom}
              >
                Ver en Alojamientos
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {palace.preCheckinRooms.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DateRangeIcon fontSize="small" color="primary" />
                  Habitaciones pre-asignadas
                </Typography>
                <List disablePadding>
                  {palace.preCheckinRooms.map((room, index) => (
                    <Fragment key={`${room.roomId}-pre`}>
                      <ListItem sx={{ py: 1 }}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1.5}
                          alignItems={{ xs: 'flex-start', md: 'center' }}
                          justifyContent="space-between"
                          flex={1}
                        >
                          <Box sx={{ flexGrow: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {room.roomName} • {room.apartmentName}
                              </Typography>
                              <Chip
                                label="Pre-asignada"
                                color="warning"
                                size="small"
                                variant="outlined"
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {room.floorName || 'Piso sin nombre'}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                              <Chip
                                icon={<AssignmentIndIcon fontSize="small" />}
                                label={room.preCheckin.guestName || 'Nombre pendiente'}
                                variant="outlined"
                                size="small"
                              />
                              <Chip
                                icon={<DateRangeIcon fontSize="small" />}
                                label={new Date(room.preCheckin.checkinDate).toLocaleString('es-ES', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                                color="primary"
                                variant="outlined"
                                size="small"
                              />
                              {room.preCheckin.notes ? (
                                <Chip label={room.preCheckin.notes} variant="outlined" size="small" />
                              ) : null}
                            </Stack>
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CheckIcon fontSize="small" />}
                              onClick={() => handleOpenPreCheckinDialog(room, room.preCheckin)}
                              disabled={actionPending}
                            >
                              Reprogramar
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              startIcon={<ClearIcon fontSize="small" />}
                              onClick={() => handleClearPreCheckin(room)}
                              disabled={actionPending}
                            >
                              Liberar
                            </Button>
                          </Stack>
                        </Stack>
                      </ListItem>
                      {index < palace.preCheckinRooms.length - 1 && <Divider component="li" light />}
                    </Fragment>
                  ))}
                </List>
              </Box>
            ) : null}

            {palace.availableRooms.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No hay habitaciones con cupos disponibles en este momento.
              </Typography>
            ) : (
              <List disablePadding sx={{ mt: palace.preCheckinRooms.length > 0 ? 3 : 0 }}>
                {palace.availableRooms.map((room, index) => (
                  <Fragment key={room.roomId}>
                    <ListItem sx={{ py: 1 }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                        flex={1}
                      >
                        <Box onClick={() => handleViewRoom(room)} sx={{ cursor: 'pointer', flexGrow: 1 }}>
                          <ListItemText
                            primary={`${room.roomName || 'Habitación'} • ${room.apartmentName || 'Apartamento'}`}
                            secondary={room.floorName || 'Piso sin nombre'}
                          />
                        </Box>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                          {room.preCheckin ? (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label="Pre-asignada"
                            />
                          ) : null}
                          <Chip
                            size="small"
                            color="success"
                            label={`${room.availableSlots} cupo${room.availableSlots === 1 ? '' : 's'}`}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AssignmentIndIcon fontSize="small" />}
                            onClick={() => handleOpenPreCheckinDialog(room, room.preCheckin)}
                            disabled={actionPending}
                          >
                            {room.preCheckin ? 'Actualizar pre-ingreso' : 'Pre-ingreso'}
                          </Button>
                        </Stack>
                      </Stack>
                    </ListItem>
                    {index < palace.availableRooms.length - 1 && <Divider component="li" light />}
                  </Fragment>
                ))}
              </List>
            )}
          </Paper>
        ))
      )}

      <Dialog open={preCheckinDialog.open} onClose={handleClosePreCheckinDialog} fullWidth maxWidth="sm">
        <DialogTitle>Programar pre-ingreso</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre del huésped / grupo"
              value={preCheckinDialog.guestName}
              onChange={(event) =>
                setPreCheckinDialog((prev) => ({ ...prev, guestName: event.target.value }))
              }
              autoFocus
              helperText="Opcional"
            />
            <TextField
              label="Fecha y hora de ingreso"
              type="datetime-local"
              value={preCheckinDialog.checkinDate}
              onChange={(event) =>
                setPreCheckinDialog((prev) => ({ ...prev, checkinDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: minDateTime }}
              required
            />
            <TextField
              label="Notas"
              value={preCheckinDialog.notes}
              onChange={(event) =>
                setPreCheckinDialog((prev) => ({ ...prev, notes: event.target.value }))
              }
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} onClick={handleClosePreCheckinDialog} disabled={actionPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleSubmitPreCheckin}
            disabled={actionPending}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Disponibilidad;

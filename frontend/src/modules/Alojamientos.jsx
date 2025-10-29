import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Hotel as HotelIcon,
  Layers as LayersIcon,
  MeetingRoom as MeetingRoomIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  SwapHoriz as SwapHorizIcon,
  Block as BlockIcon,
  PersonOff as PersonOffIcon
} from '@mui/icons-material';
import { alojamientosAPI, colaboradoresAPI, handleAPIError } from '../services/api';
import { loadStoredMttoReports, MTTO_REPORTS_STORAGE_KEY } from './mttoConstants';
import { subscribeActiveTenantNamespace } from './utils/branding';

const createTempId = () => `temp_${Math.random().toString(36).slice(2, 10)}`;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const MAX_COLLABORATORS_PER_ROOM = 2;

const APARTMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Operativo' },
  { value: 'out_of_service', label: 'Fuera de servicio' }
];

const getApartmentStatusLabel = (value) => {
  if (!value) {
    return '';
  }
  const normalized = String(value).toLowerCase();
  const option = APARTMENT_STATUS_OPTIONS.find((item) => item.value === normalized);
  return option ? option.label : '';
};

const MAINTENANCE_AREA_OPTIONS = [
  { value: 'room', label: 'Habitación' },
  { value: 'bathroom', label: 'Baños' },
  { value: 'common', label: 'Zona común' }
];

const getMaintenanceAreaLabel = (value) => {
  if (!value) {
    return '';
  }
  const normalized = String(value).toLowerCase();
  const option = MAINTENANCE_AREA_OPTIONS.find((item) => item.value === normalized);
  return option ? option.label : '';
};

const applyMttoReportsToPalaces = (palaces) => {
  const { reports } = loadStoredMttoReports();
  if (!Array.isArray(palaces) || palaces.length === 0 || reports.length === 0) {
    return palaces;
  }

  const activeReports = reports.filter((report) => report && report.status !== 'resolved');
  if (activeReports.length === 0) {
    return palaces;
  }

  const latestByRoom = new Map();
  activeReports.forEach((report) => {
    if (!report.palaceId || !report.apartmentId || !report.roomId) {
      return;
    }
    const key = `${report.palaceId}::${report.apartmentId}::${report.roomId}`;
    const current = latestByRoom.get(key);
    const nextTimestamp = new Date(report.reportedAt || 0).getTime();
    const currentTimestamp = current ? new Date(current.reportedAt || 0).getTime() : -Infinity;
    if (!current || nextTimestamp >= currentTimestamp) {
      latestByRoom.set(key, report);
    }
  });

  if (latestByRoom.size === 0) {
    return palaces;
  }

  const cloned = deepClone(palaces);
  cloned.forEach((palace) => {
    if (!palace || !palace.floors) {
      return;
    }
    palace.floors.forEach((floor) => {
      if (!floor || !floor.apartments) {
        return;
      }
      floor.apartments.forEach((apartment) => {
        if (!apartment || !apartment.rooms) {
          return;
        }
        apartment.rooms.forEach((room) => {
          if (!room) {
            return;
          }
          const key = `${palace.id}::${apartment.id}::${room.id}`;
          const report = latestByRoom.get(key);
          if (!report) {
            return;
          }

          room.status = 'maintenance';
          room.maintenanceNote = report.description || report.notes || '';
          room.maintenanceZone = report.zone || '';
          room.maintenanceAreaType = report.areaValue || '';
          room.maintenanceUpdatedAt = report.reportedAt || report.resolvedAt || new Date().toISOString();
          room.mttoReportId = report.id;
          room.mttoReportPriority = report.priority || 'Media';
        });
      });
    });
  });

  return cloned;
};

const ASSIGNMENT_DIALOG_INITIAL_STATE = {
  open: false,
  mode: 'assign',
  palaceId: null,
  palaceName: '',
  roomId: null,
  selectedCollaborators: [],
  movingCollaborator: null,
  sourcePalaceId: null,
  sourcePalaceName: '',
  sourceFloorId: null,
  sourceFloorName: '',
  sourceApartmentId: null,
  sourceApartmentName: '',
  sourceRoomId: null,
  sourceRoomName: '',
  moveAssignments: []
};

const UNASSIGN_DIALOG_INITIAL_STATE = {
  open: false,
  palaceId: null,
  palaceName: '',
  options: [],
  selectedOption: null,
  error: null
};

const formatRoomStatusLabel = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'available':
      return 'Disponible';
    case 'occupied':
      return 'Ocupado';
    case 'maintenance':
      return 'Mantenimiento';
    case 'cleaning':
      return 'Mantenimiento';
    default:
      return status || 'Desconocido';
  }
};

const getRoomStatusColor = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'available':
      return 'success';
    case 'occupied':
      return 'primary';
    case 'maintenance':
      return 'warning';
    case 'cleaning':
      return 'warning';
    default:
      return 'default';
  }
};

const formatMaintenanceTimestamp = (value) => {
  if (!value) {
    return 'Actualizado hace instantes';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Actualizado hace instantes';
  }

  return `Actualizado: ${new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)}`;
};

const ROOM_EDIT_INITIAL_STATE = {
  open: false,
  palaceId: null,
  palaceName: '',
  floorId: null,
  floorName: '',
  apartmentId: null,
  apartmentName: '',
  roomId: null,
  roomName: '',
  capacity: '',
  guests: '',
  status: 'available'
};

const normalizePalaceStructure = (palace) => {
  palace.floors.forEach((floor, floorIdx) => {
    floor.number = floorIdx + 1;
    floor.name = `Piso ${floor.number}`;
    floor.apartments.forEach((apartment, apartmentIdx) => {
      apartment.number = apartmentIdx + 1;
      apartment.name = `Apartamento ${floor.number}${String.fromCharCode(65 + apartmentIdx)}`;
      const statusValue = typeof apartment.status === 'string' ? apartment.status.toLowerCase() : '';
      const statusOption = APARTMENT_STATUS_OPTIONS.find((item) => item.value === statusValue);
      apartment.status = statusOption ? statusOption.value : 'active';
      if (apartment.status === 'out_of_service') {
        apartment.outOfServiceNote = typeof apartment.outOfServiceNote === 'string' ? apartment.outOfServiceNote : '';
      } else {
        apartment.outOfServiceNote = '';
      }
      apartment.rooms.forEach((room, roomIdx) => {
        room.name = `Habitación ${floor.number}${apartment.number}${roomIdx + 1}`;
      });
    });
  });
  palace.updatedAt = new Date().toISOString();
  return palace;
};

const createClientApartment = ({ floorNumber, apartmentNumber, roomsPerApartment, capacity }) => ({
  id: createTempId(),
  name: `Apartamento ${floorNumber}${String.fromCharCode(65 + apartmentNumber - 1)}`,
  number: apartmentNumber,
  status: 'active',
  outOfServiceNote: '',
  rooms: Array.from({ length: roomsPerApartment }).map((_, roomIdx) => ({
    id: createTempId(),
    name: `Habitación ${floorNumber}${apartmentNumber}${roomIdx + 1}`,
    capacity,
    guests: 0,
    status: 'available',
    collaboratorIds: [],
    collaborators: [],
    maintenanceNote: '',
    maintenanceZone: '',
    maintenanceAreaType: '',
    maintenanceUpdatedAt: null
  }))
});

const createClientFloor = ({
  floorNumber,
  apartmentsPerFloor,
  roomsPerApartment,
  capacity
}) => ({
  id: createTempId(),
  name: `Piso ${floorNumber}`,
  number: floorNumber,
  apartments: Array.from({ length: apartmentsPerFloor }).map((_, apartmentIdx) =>
    createClientApartment({
      floorNumber,
      apartmentNumber: apartmentIdx + 1,
      roomsPerApartment,
      capacity
    })
  )
});

const getPalaceStats = (palace) => {
  let rooms = 0;
  let occupied = 0;
  let maintenance = 0;
  let guests = 0;
  let capacity = 0;
  let apartmentsOutOfService = 0;

  palace.floors.forEach((floor) => {
    floor.apartments.forEach((apartment) => {
      const isApartmentOut = apartment.status === 'out_of_service';
      if (isApartmentOut) {
        apartmentsOutOfService += 1;
      }
      apartment.rooms.forEach((room) => {
        rooms += 1;
        const roomCapacity = Number(room.capacity) || 0;
        const roomGuests = Number(room.guests) || 0;
        capacity += roomCapacity;
        guests += roomGuests;
        let effectiveStatus = isApartmentOut ? 'maintenance' : (room.status || 'available');
        if (effectiveStatus === 'cleaning') {
          effectiveStatus = 'maintenance';
        }
        if (effectiveStatus === 'maintenance') {
          maintenance += 1;
        }
        if (!isApartmentOut && (effectiveStatus === 'occupied' || roomGuests > 0)) {
          occupied += 1;
        }
      });
    });
  });

  const available = rooms - occupied - maintenance;
  const occupancyRate = capacity ? Math.round((guests / capacity) * 100) : 0;

  return {
    rooms,
    occupied,
    available: Math.max(available, 0),
    maintenance,
    guests,
    capacity,
    occupancyRate,
    apartmentsOutOfService
  };

};

const Alojamientos = () => {
  const location = useLocation();
  const [palaces, setPalaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    seriesNumber: '',
    floors: 3,
    apartmentsPerFloor: 4,
    roomsPerApartment: 2,
    capacityPerRoom: 2,
    customName: ''
  });
  const [dirtyMap, setDirtyMap] = useState({});
  const [savingPalaceId, setSavingPalaceId] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [collaboratorsError, setCollaboratorsError] = useState(null);
  const [assignmentDialog, setAssignmentDialog] = useState(ASSIGNMENT_DIALOG_INITIAL_STATE);
  const [unassignDialog, setUnassignDialog] = useState(UNASSIGN_DIALOG_INITIAL_STATE);
  const [assignmentError, setAssignmentError] = useState(null);
  const [roomEditDialog, setRoomEditDialog] = useState(ROOM_EDIT_INITIAL_STATE);
  const [roomEditError, setRoomEditError] = useState(null);
  const [apartmentStatusDialog, setApartmentStatusDialog] = useState({ open: false, palaceId: null });
  const [focusRequest, setFocusRequest] = useState(null);
  const [highlightedRoomId, setHighlightedRoomId] = useState(null);
  const [expandedPalaces, setExpandedPalaces] = useState({});
  const lastFocusTokenRef = useRef(null);
  const highlightTimeoutRef = useRef(null);

  const moverNameLabel = useMemo(() => {
    if (!assignmentDialog.movingCollaborator) {
      return '';
    }
    const nameParts = [assignmentDialog.movingCollaborator.nombre, assignmentDialog.movingCollaborator.apellido]
      .map((part) => (part ? part.trim() : ''))
      .filter(Boolean);
    if (nameParts.length > 0) {
      return nameParts.join(' ');
    }
    return assignmentDialog.movingCollaborator.codigo || '';
  }, [assignmentDialog.movingCollaborator]);

  const sourceLocationLabel = useMemo(() => {
    const segments = [assignmentDialog.sourceRoomName, assignmentDialog.sourceApartmentName, assignmentDialog.sourceFloorName]
      .map((value) => (value ? value.trim() : ''))
      .filter(Boolean);
    return segments.join(' • ');
  }, [assignmentDialog.sourceApartmentName, assignmentDialog.sourceFloorName, assignmentDialog.sourceRoomName]);

  const closeFeedback = () => setFeedback(null);

  const fetchPalaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await alojamientosAPI.getPalaces();
      const palacesData = data?.palaces ?? data?.data ?? data ?? [];
      const orderedPalaces = Array.isArray(palacesData)
        ? palacesData.sort((a, b) => (a.seriesNumber || 0) - (b.seriesNumber || 0))
        : [];
      const palacesWithMtto = applyMttoReportsToPalaces(orderedPalaces);
      setPalaces(palacesWithMtto);
      setSummary(data?.summary ?? data?.data?.summary ?? null);
      setDirtyMap({});
    } catch (err) {
      setError(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPalaces();
  }, [fetchPalaces]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event && event.key && !event.key.startsWith(MTTO_REPORTS_STORAGE_KEY)) {
        return;
      }
      fetchPalaces();
    };

    const handleCustomEvent = () => {
      fetchPalaces();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('mtto-reports-updated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('mtto-reports-updated', handleCustomEvent);
    };
  }, [fetchPalaces]);

  useEffect(() => {
    const unsubscribe = subscribeActiveTenantNamespace?.(() => {
      fetchPalaces();
    });
    return unsubscribe;
  }, [fetchPalaces]);

  useEffect(() => {
    const state = location?.state;
    if (state && state.focusRoomId) {
      const token = state.focusToken || `${state.focusPalaceId || 'palace'}-${state.focusFloorId || 'floor'}-${state.focusApartmentId || 'apartment'}-${state.focusRoomId}-${Date.now()}`;

      if (lastFocusTokenRef.current === token) {
        return;
      }

      lastFocusTokenRef.current = token;

      setFocusRequest({
        palaceId: state.focusPalaceId || null,
        floorId: state.focusFloorId || null,
        apartmentId: state.focusApartmentId || null,
        roomId: state.focusRoomId
      });
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, [location]);

  useEffect(() => {
    if (!focusRequest?.palaceId) {
      return;
    }

    setExpandedPalaces((prev) => {
      if (prev[focusRequest.palaceId]) {
        return prev;
      }

      return {
        ...prev,
        [focusRequest.palaceId]: true
      };
    });
  }, [focusRequest?.palaceId]);

  useEffect(() => {
    if (!focusRequest || loading) {
      return;
    }

    const attemptFocus = () => {
      if (!focusRequest?.roomId) {
        return false;
      }

      const element = document.getElementById(`room-card-${focusRequest.roomId}`);
      if (!element) {
        return false;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedRoomId(focusRequest.roomId);

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedRoomId(null);
      }, 4000);

      return true;
    };

    if (!attemptFocus()) {
      const timeoutId = setTimeout(() => {
        if (attemptFocus()) {
          setFocusRequest(null);
        }
      }, 350);

      return () => clearTimeout(timeoutId);
    }

    setFocusRequest(null);
  }, [focusRequest, loading, palaces, expandedPalaces]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  const fetchCollaborators = async () => {
    try {
      setLoadingCollaborators(true);
      setCollaboratorsError(null);
      const { data } = await colaboradoresAPI.getColaboradores({ estado: 'activos' });
      setCollaborators(data?.colaboradores ?? []);
    } catch (err) {
      setCollaboratorsError(handleAPIError(err));
    } finally {
      setLoadingCollaborators(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDirty = (palaceId) => {
    setDirtyMap((prev) => ({ ...prev, [palaceId]: true }));
  };

  const updatePalaceState = (palaceId, mutateFn) => {
    setPalaces((prev) =>
      prev.map((palace) => {
        if (palace.id !== palaceId) {
          return palace;
        }
        const draft = normalizePalaceStructure(deepClone(palace));
        mutateFn(draft);
        return normalizePalaceStructure(draft);
      })
    );
    markDirty(palaceId);
  };

  const collaboratorOptions = useMemo(() => {
    const registry = new Map();

    collaborators.forEach((item) => {
      if (item?.id) {
        registry.set(item.id, item);
      }
    });

    palaces.forEach((palace) => {
      palace.floors.forEach((floor) => {
        floor.apartments.forEach((apartment) => {
          apartment.rooms.forEach((room) => {
            if (Array.isArray(room?.collaborators)) {
              room.collaborators.forEach((assigned) => {
                if (assigned?.id) {
                  registry.set(assigned.id, assigned);
                }
              });
            }
          });
        });
      });
    });

    return Array.from(registry.values());
  }, [collaborators, palaces]);

  const palaceAssignmentsMap = useMemo(() => {
    const palaceMap = new Map();

    palaces.forEach((palace) => {
      const collaboratorMap = new Map();

      palace.floors.forEach((floor) => {
        floor.apartments.forEach((apartment) => {
          apartment.rooms.forEach((room) => {
            const rawList = Array.isArray(room.collaborators) ? room.collaborators : [];
            const seen = new Set();
            rawList.forEach((item) => {
              if (!item?.id || seen.has(item.id)) {
                return;
              }
              seen.add(item.id);

              if (!collaboratorMap.has(item.id)) {
                collaboratorMap.set(item.id, {
                  collaborator: item,
                  assignments: []
                });
              }

              collaboratorMap.get(item.id).assignments.push({
                collaborator: item,
                palaceId: palace.id,
                palaceName: palace.name,
                floorId: floor.id,
                floorName: floor.name,
                apartmentId: apartment.id,
                apartmentName: apartment.name,
                apartmentStatus: apartment.status,
                apartmentNote: apartment.outOfServiceNote,
                roomId: room.id,
                roomName: room.name,
                roomStatus: room.status
              });
            });
          });
        });
      });

      const entries = Array.from(collaboratorMap.values())
        .map((entry) => ({
          collaborator: entry.collaborator,
          assignments: entry.assignments
            .slice()
            .sort((a, b) => a.roomName.localeCompare(b.roomName))
        }))
        .filter((entry) => entry.assignments.length > 0)
        .sort((a, b) => {
          const nameA = `${a.collaborator.nombre || ''} ${a.collaborator.apellido || ''}`.trim().toLowerCase();
          const nameB = `${b.collaborator.nombre || ''} ${b.collaborator.apellido || ''}`.trim().toLowerCase();
          if (nameA && nameB) {
            return nameA.localeCompare(nameB);
          }
          return (a.collaborator.codigo || '').localeCompare(b.collaborator.codigo || '');
        });

      palaceMap.set(palace.id, entries);
    });

    return palaceMap;
  }, [palaces]);

  const buildUnassignOptionsForPalace = useCallback(
    (palaceId) => {
      if (!palaceId) {
        return [];
      }

      const entries = palaceAssignmentsMap.get(palaceId) || [];
      const options = [];

      entries.forEach(({ collaborator, assignments }) => {
        assignments.forEach((assignment) => {
          options.push({
            key: `${collaborator.id}-${assignment.roomId}`,
            collaborator,
            assignment
          });
        });
      });

      return options;
    },
    [palaceAssignmentsMap]
  );

  useEffect(() => {
    if (!unassignDialog.open || !unassignDialog.palaceId) {
      return;
    }

    const options = buildUnassignOptionsForPalace(unassignDialog.palaceId);

    if (options.length === 0) {
      setUnassignDialog(UNASSIGN_DIALOG_INITIAL_STATE);
      setFeedback({
        type: 'info',
  message: `Ya no quedan colaboradores asignados en ${unassignDialog.palaceName || 'este edificio'} para desasignar.`
      });
      return;
    }

    setUnassignDialog((prev) => {
      if (!prev.open) {
        return prev;
      }

      const prevKey = prev.selectedOption?.key || null;
      const nextSelected = options.find((option) => option.key === prevKey) || options[0] || null;

      const sameLength = options.length === prev.options.length;
      const sameKeys =
        sameLength && options.every((option, index) => option.key === prev.options[index]?.key);

      if (sameKeys && nextSelected?.key === prev.selectedOption?.key) {
        return prev;
      }

      return {
        ...prev,
        options,
        selectedOption: nextSelected,
        error: null
      };
    });
  }, [buildUnassignOptionsForPalace, setFeedback, unassignDialog.open, unassignDialog.palaceId, unassignDialog.palaceName]);

  const apartmentStatusDialogContext = useMemo(() => {
    if (!apartmentStatusDialog.open || !apartmentStatusDialog.palaceId) {
      return null;
    }

    return palaces.find((item) => item.id === apartmentStatusDialog.palaceId) || null;
  }, [apartmentStatusDialog, palaces]);

  const getPalaceRoomsForAssignment = useCallback((palaceId) => {
    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) {
      return [];
    }

    const rooms = [];

    palace.floors.forEach((floor) => {
      floor.apartments.forEach((apartment) => {
        if (apartment.status === 'out_of_service') {
          return;
        }
        apartment.rooms.forEach((room) => {
          const collaboratorListRaw = Array.isArray(room.collaborators) ? room.collaborators : [];
          const collaboratorIdsRaw = Array.isArray(room.collaboratorIds)
            ? room.collaboratorIds.filter(Boolean)
            : collaboratorListRaw.map((item) => item?.id).filter(Boolean);

          const seen = new Set();
          const normalizedCollaborators = [];
          const normalizedIds = [];

          collaboratorListRaw.forEach((item) => {
            if (item?.id && !seen.has(item.id)) {
              seen.add(item.id);
              normalizedCollaborators.push(item);
              normalizedIds.push(item.id);
            }
          });

          collaboratorIdsRaw.forEach((id) => {
            if (id && !seen.has(id)) {
              const collaborator = collaboratorOptions.find((option) => option.id === id);
              if (collaborator) {
                seen.add(id);
                normalizedCollaborators.push(collaborator);
                normalizedIds.push(id);
              }
            }
          });

          const availableSlots = Math.max(MAX_COLLABORATORS_PER_ROOM - normalizedCollaborators.length, 0);

          rooms.push({
            palaceId: palace.id,
            palaceName: palace.name,
            floorId: floor.id,
            floorName: floor.name,
            apartmentId: apartment.id,
            apartmentName: apartment.name,
            id: room.id,
            name: room.name,
            status: room.status,
            capacity: room.capacity,
            guests: room.guests,
            collaborators: normalizedCollaborators.slice(0, MAX_COLLABORATORS_PER_ROOM),
            collaboratorIds: normalizedIds.slice(0, MAX_COLLABORATORS_PER_ROOM),
            availableSlots,
            maintenanceNote: room.maintenanceNote || '',
            maintenanceZone: room.maintenanceZone || '',
            maintenanceAreaType: room.maintenanceAreaType || '',
            maintenanceUpdatedAt: room.maintenanceUpdatedAt || null
          });
        });
      });
    });

    return rooms;
  }, [palaces, collaboratorOptions]);

  const updateRoomDetails = (palaceId, floorId, apartmentId, roomId, updates) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      const room = apartment.rooms.find((item) => item.id === roomId);
      if (!room) return;

      if (Object.prototype.hasOwnProperty.call(updates, 'capacity')) {
        const capacityValue = Math.max(1, Number(updates.capacity));
        room.capacity = capacityValue;
        if (room.guests > capacityValue) {
          room.guests = capacityValue;
        }
        if (room.guests === 0 && room.status === 'occupied') {
          room.status = 'available';
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'guests')) {
        const guestsValue = Math.max(0, Math.min(Number(updates.guests), room.capacity));
        room.guests = guestsValue;
        if (guestsValue === 0 && room.status === 'occupied') {
          room.status = 'available';
        }
        if (guestsValue > 0) {
          room.status = 'occupied';
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
        const statusValue = updates.status;
        room.status = statusValue;
        if (statusValue !== 'occupied') {
          room.guests = 0;
        } else if (room.guests === 0) {
          room.guests = Math.min(1, room.capacity);
        }
        if (statusValue !== 'maintenance') {
          room.maintenanceNote = '';
          room.maintenanceZone = '';
          room.maintenanceAreaType = '';
          room.maintenanceUpdatedAt = null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'maintenanceNote')) {
        room.maintenanceNote = updates.maintenanceNote || '';
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'maintenanceZone')) {
        room.maintenanceZone = updates.maintenanceZone || '';
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'maintenanceAreaType')) {
        room.maintenanceAreaType = updates.maintenanceAreaType || '';
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'maintenanceUpdatedAt')) {
        room.maintenanceUpdatedAt = updates.maintenanceUpdatedAt || null;
      }
    });
  };

  const handleAssignCollaborators = (palaceId, floorId, apartmentId, roomId, collaboratorList) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      const room = apartment.rooms.find((item) => item.id === roomId);
      if (!room) return;

      const safeList = Array.isArray(collaboratorList) ? collaboratorList.filter(Boolean).slice(0, MAX_COLLABORATORS_PER_ROOM) : [];
      room.collaboratorIds = safeList.map((item) => item.id);
      room.collaborators = safeList.map((item) => ({ ...item }));

      const collaboratorsCount = safeList.length;
      if (collaboratorsCount > room.capacity) {
        room.capacity = collaboratorsCount;
      }
      room.guests = collaboratorsCount;
      room.status = collaboratorsCount > 0 ? 'occupied' : 'available';
      if (room.status !== 'maintenance') {
        room.maintenanceNote = '';
        room.maintenanceZone = '';
        room.maintenanceAreaType = '';
        room.maintenanceUpdatedAt = null;
      }
    });
  };

  const handleRemoveCollaboratorFromRoom = (palaceId, floorId, apartmentId, roomId, collaboratorId) => {
    if (!collaboratorId) {
      return;
    }

    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      const room = apartment.rooms.find((item) => item.id === roomId);
      if (!room) return;

      const normalized = Array.isArray(room.collaborators)
        ? room.collaborators.filter((item) => item && item.id !== collaboratorId)
        : [];

      room.collaborators = normalized.map((item) => ({ ...item }));
      room.collaboratorIds = room.collaborators.map((item) => item.id);

      const remaining = room.collaborators.length;
      const wasMaintenance = room.status === 'maintenance';

      if (remaining === 0) {
        room.guests = 0;
        if (!wasMaintenance) {
          room.status = 'available';
        }
      } else {
        if (remaining > room.capacity) {
          room.capacity = remaining;
        }
        room.guests = remaining;
        if (!wasMaintenance) {
          room.status = 'occupied';
        }
      }
    });
  };

  const openUnassignDialogForPalace = (palace) => {
    const options = buildUnassignOptionsForPalace(palace.id);

    if (options.length === 0) {
      setFeedback({
        type: 'info',
        message: `No hay colaboradores asignados en ${palace.name} para desasignar.`
      });
      return;
    }

    setUnassignDialog({
      open: true,
      palaceId: palace.id,
      palaceName: palace.name,
      options,
      selectedOption: options[0] || null,
      error: null
    });
  };

  const closeUnassignDialog = () => {
    setUnassignDialog(UNASSIGN_DIALOG_INITIAL_STATE);
  };

  const handleSelectUnassignOption = (option) => {
    setUnassignDialog((prev) => ({
      ...prev,
      selectedOption: option || null,
      error: null
    }));
  };

  const handleConfirmUnassign = () => {
    if (!unassignDialog.selectedOption) {
      setUnassignDialog((prev) => ({
        ...prev,
        error: 'Selecciona un colaborador asignado para desasignar.'
      }));
      return;
    }

    const { collaborator, assignment } = unassignDialog.selectedOption;

    if (!collaborator?.id || !assignment?.roomId) {
      setUnassignDialog((prev) => ({
        ...prev,
        error: 'Selecciona un colaborador válido.'
      }));
      return;
    }

    handleRemoveCollaboratorFromRoom(
      unassignDialog.palaceId,
      assignment.floorId,
      assignment.apartmentId,
      assignment.roomId,
      collaborator.id
    );

    setHighlightedRoomId(assignment.roomId);

    const collaboratorLabel = `${[collaborator.nombre, collaborator.apellido]
      .filter(Boolean)
      .join(' ') || collaborator.codigo || 'El colaborador'}`;
    const assignmentLabel = assignment.roomName
      ? `${assignment.roomName} en ${unassignDialog.palaceName}`
      : 'la habitación seleccionada';

    setFeedback({
      type: 'success',
  message: `${collaboratorLabel} fue desasignado de ${assignmentLabel}. No olvides guardar los cambios del edificio para persistirlos.`
    });

    closeUnassignDialog();
  };

  const assignmentRooms = useMemo(() => {
    if (!assignmentDialog.open || !assignmentDialog.palaceId) {
      return [];
    }
    return getPalaceRoomsForAssignment(assignmentDialog.palaceId);
  }, [assignmentDialog.open, assignmentDialog.palaceId, getPalaceRoomsForAssignment]);

  const selectedAssignmentRoom = useMemo(() => {
    if (!assignmentDialog.open || !assignmentDialog.roomId) {
      return null;
    }
    return assignmentRooms.find((room) => room.id === assignmentDialog.roomId) || null;
  }, [assignmentDialog.open, assignmentDialog.roomId, assignmentRooms]);

  const moveAssignmentOptions = useMemo(() => {
    if (!assignmentDialog.open || assignmentDialog.mode !== 'move') {
      return [];
    }

    const entries = Array.isArray(assignmentDialog.moveAssignments) ? assignmentDialog.moveAssignments : [];
    const options = [];

    entries.forEach((entry) => {
      const collaborator = entry?.collaborator;
      if (!collaborator?.id) {
        return;
      }

      const assignments = Array.isArray(entry.assignments) ? entry.assignments : [];
      assignments.forEach((assignment) => {
        if (!assignment?.roomId) {
          return;
        }
        options.push({
          key: `${collaborator.id}-${assignment.roomId}`,
          collaborator,
          assignment
        });
      });
    });

    return options;
  }, [assignmentDialog.open, assignmentDialog.mode, assignmentDialog.moveAssignments]);

  const selectedMoveAssignment = useMemo(() => {
    if (assignmentDialog.mode !== 'move') {
      return null;
    }

    return (
      moveAssignmentOptions.find((option) => {
        const collaboratorMatch = option.collaborator?.id === assignmentDialog.movingCollaborator?.id;
        const roomMatch = option.assignment?.roomId === assignmentDialog.sourceRoomId;
        const apartmentMatch = option.assignment?.apartmentId === assignmentDialog.sourceApartmentId;
        return collaboratorMatch && roomMatch && apartmentMatch;
      }) || null
    );
  }, [assignmentDialog.mode, assignmentDialog.movingCollaborator, assignmentDialog.sourceRoomId, assignmentDialog.sourceApartmentId, moveAssignmentOptions]);

  const handleSelectMoveAssignment = (option) => {
    if (!option) {
      setAssignmentDialog((prev) => ({
        ...prev,
        movingCollaborator: null,
        selectedCollaborators: [],
        sourcePalaceId: prev.palaceId,
        sourcePalaceName: prev.palaceName,
        sourceFloorId: null,
        sourceFloorName: '',
        sourceApartmentId: null,
        sourceApartmentName: '',
        sourceRoomId: null,
        sourceRoomName: ''
      }));
      return;
    }

    setAssignmentDialog((prev) => ({
      ...prev,
      palaceId: option.assignment.palaceId,
      palaceName: option.assignment.palaceName,
      movingCollaborator: option.collaborator,
      selectedCollaborators: [option.collaborator],
      sourcePalaceId: option.assignment.palaceId,
      sourcePalaceName: option.assignment.palaceName,
      sourceFloorId: option.assignment.floorId,
      sourceFloorName: option.assignment.floorName,
      sourceApartmentId: option.assignment.apartmentId,
      sourceApartmentName: option.assignment.apartmentName,
      sourceRoomId: option.assignment.roomId,
      sourceRoomName: option.assignment.roomName,
      roomId: prev.roomId === option.assignment.roomId ? null : prev.roomId
    }));
    setAssignmentError(null);
  };

  const openAssignmentDialogForPalace = (palace) => {
    if (!palace) {
      return;
    }

    const rooms = getPalaceRoomsForAssignment(palace.id);
    const defaultRoom = rooms.find((item) => item.availableSlots > 0) || rooms[0] || null;
    const defaultSelected = defaultRoom
      ? defaultRoom.collaborators.slice(0, MAX_COLLABORATORS_PER_ROOM)
      : [];

    setAssignmentDialog({
      ...ASSIGNMENT_DIALOG_INITIAL_STATE,
      open: true,
      mode: 'assign',
      palaceId: palace.id,
      palaceName: palace.name,
      roomId: defaultRoom ? defaultRoom.id : null,
      selectedCollaborators: defaultSelected
    });
    setAssignmentError(null);
  };

  const openMoveDialogForPalace = (palace) => {
    if (!palace) {
      return;
    }

    const entries = palaceAssignmentsMap.get(palace.id) || [];

    if (entries.length === 0) {
      setFeedback({
        type: 'info',
        message: `No hay colaboradores asignados en ${palace.name} para mover.`
      });
      return;
    }

    const firstAssignment = entries[0]?.assignments?.[0] || null;
    const firstCollaborator = entries[0]?.collaborator || null;

    setAssignmentDialog({
      ...ASSIGNMENT_DIALOG_INITIAL_STATE,
      open: true,
      mode: 'move',
      palaceId: palace.id,
      palaceName: palace.name,
      movingCollaborator: firstCollaborator || null,
      selectedCollaborators: firstCollaborator ? [firstCollaborator] : [],
      sourcePalaceId: firstAssignment?.palaceId || palace.id,
      sourcePalaceName: firstAssignment?.palaceName || palace.name,
      sourceFloorId: firstAssignment?.floorId || null,
      sourceFloorName: firstAssignment?.floorName || '',
      sourceApartmentId: firstAssignment?.apartmentId || null,
      sourceApartmentName: firstAssignment?.apartmentName || '',
      sourceRoomId: firstAssignment?.roomId || null,
      sourceRoomName: firstAssignment?.roomName || '',
      moveAssignments: entries
    });
    setAssignmentError(null);
  };

  const closeAssignmentDialog = () => {
    setAssignmentDialog(ASSIGNMENT_DIALOG_INITIAL_STATE);
    setAssignmentError(null);
  };

  const handleSelectAssignmentRoom = (roomId) => {
    setAssignmentDialog((prev) => {
      if (!prev.palaceId) {
        return prev;
      }

      const rooms = getPalaceRoomsForAssignment(prev.palaceId);
      const target = rooms.find((item) => item.id === roomId) || null;

      if (!target) {
        setAssignmentError(prev.mode === 'move' ? 'Selecciona una habitación válida.' : null);
        return {
          ...prev,
          roomId: null,
          selectedCollaborators:
            prev.mode === 'move' && prev.movingCollaborator ? [prev.movingCollaborator] : []
        };
      }

      let nextSelected = target.collaborators.slice(0, MAX_COLLABORATORS_PER_ROOM);

      if (prev.mode === 'move' && prev.movingCollaborator) {
        const alreadyIncluded = nextSelected.some((item) => item.id === prev.movingCollaborator.id);
        if (!alreadyIncluded) {
          if (nextSelected.length >= MAX_COLLABORATORS_PER_ROOM) {
            setAssignmentError('La habitación seleccionada no tiene cupos disponibles para mover al colaborador.');
            return prev;
          }
          nextSelected = [...nextSelected, prev.movingCollaborator];
        }
      }

      setAssignmentError(null);
      return {
        ...prev,
        roomId: target.id,
        palaceName: target.palaceName,
        selectedCollaborators: nextSelected
      };
    });
  };

  const handleAssignmentCollaboratorChange = (newList) => {
    setAssignmentDialog((prev) => {
      const sanitizedRaw = Array.isArray(newList) ? newList.filter(Boolean) : [];

      const deduped = [];
      const seen = new Set();

      sanitizedRaw.forEach((item) => {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          deduped.push(item);
        }
      });

      const mover = prev.mode === 'move' ? prev.movingCollaborator : null;
      if (mover?.id && !deduped.some((item) => item.id === mover.id)) {
        deduped.unshift(mover);
      }

      const limited = deduped.slice(0, MAX_COLLABORATORS_PER_ROOM);

      if (mover?.id && !limited.some((item) => item.id === mover.id)) {
        limited.pop();
        limited.unshift(mover);
      }

      return {
        ...prev,
        selectedCollaborators: limited
      };
    });
    setAssignmentError(null);
  };

  const handleAssignmentSubmit = () => {
    if (!assignmentDialog.palaceId || !assignmentDialog.roomId) {
      setAssignmentError('Selecciona una habitación disponible.');
      return;
    }

    const rooms = getPalaceRoomsForAssignment(assignmentDialog.palaceId);
    const target = rooms.find((item) => item.id === assignmentDialog.roomId);

    if (!target) {
      setAssignmentError('La habitación seleccionada ya no está disponible.');
      return;
    }

    const mover = assignmentDialog.mode === 'move' ? assignmentDialog.movingCollaborator : null;

    if (assignmentDialog.mode === 'move') {
      if (!mover?.id) {
        setAssignmentError('Selecciona el colaborador y la habitación de origen que deseas mover.');
        return;
      }

      if (
        assignmentDialog.sourcePalaceId === target.palaceId &&
        assignmentDialog.sourceRoomId === target.id
      ) {
        setAssignmentError('Selecciona una habitación diferente para mover al colaborador.');
        return;
      }

      if (!assignmentDialog.selectedCollaborators.some((item) => item?.id === mover.id)) {
        setAssignmentError('Debes mantener al colaborador a mover en la nueva habitación.');
        return;
      }
    }

    const collaboratorsToAssign = assignmentDialog.selectedCollaborators.slice(0, MAX_COLLABORATORS_PER_ROOM);

    handleAssignCollaborators(
      assignmentDialog.palaceId,
      target.floorId,
      target.apartmentId,
      target.id,
      collaboratorsToAssign
    );

    if (
      assignmentDialog.mode === 'move' &&
      mover?.id &&
      assignmentDialog.sourcePalaceId &&
      assignmentDialog.sourceRoomId &&
      (assignmentDialog.sourcePalaceId !== target.palaceId || assignmentDialog.sourceRoomId !== target.id)
    ) {
      handleRemoveCollaboratorFromRoom(
        assignmentDialog.sourcePalaceId,
        assignmentDialog.sourceFloorId,
        assignmentDialog.sourceApartmentId,
        assignmentDialog.sourceRoomId,
        mover.id
      );
    }

    const moverDisplayName = assignmentDialog.mode === 'move'
      ? moverNameLabel || mover?.codigo || 'El colaborador'
      : '';

    setFeedback({
      type: 'success',
      message:
        assignmentDialog.mode === 'move'
          ? `${moverDisplayName} fue movido a ${target.name} en ${assignmentDialog.palaceName}. No olvides guardar los cambios del edificio para persistirlos.`
          : `Se actualizaron los colaboradores para ${target.name} en ${assignmentDialog.palaceName}. No olvides guardar los cambios del edificio para persistirlos.`
    });
    closeAssignmentDialog();
  };

  const openRoomEditDialog = (palace, floor, apartment, room) => {
    if (!palace || !floor || !apartment || !room) {
      return;
    }

    const assignedCollaborators = Array.isArray(room.collaborators)
      ? room.collaborators.filter((item) => item && item.id)
      : [];
    const assignedCount = assignedCollaborators.length;
    const currentGuests = Number(room.guests ?? 0);
    const computedGuests = Math.max(currentGuests, assignedCount);
    const safeCapacity = Number(room.capacity ?? 0);
    const clampedGuests = safeCapacity > 0 ? Math.min(computedGuests, safeCapacity) : computedGuests;

    const normalizedStatus = ['occupied', 'available'].includes(room.status)
      ? room.status
      : 'available';

    setRoomEditDialog({
      open: true,
      palaceId: palace.id,
      palaceName: palace.name || '',
      floorId: floor.id,
      floorName: floor.name || '',
      apartmentId: apartment.id,
      apartmentName: apartment.name || '',
      roomId: room.id,
      roomName: room.name,
      capacity: String(room.capacity ?? ''),
      guests: String(Number.isNaN(clampedGuests) ? assignedCount : clampedGuests),
      status: normalizedStatus
    });
    setRoomEditError(null);
  };

  const closeRoomEditDialog = () => {
    setRoomEditDialog(ROOM_EDIT_INITIAL_STATE);
    setRoomEditError(null);
  };

  const handleRoomEditInputChange = (field, value) => {
    setRoomEditDialog((prev) => {
      if (field === 'status') {
        const normalizedValue = ['available', 'occupied'].includes(value) ? value : 'available';
        const nextState = { ...prev, status: normalizedValue };
        if (normalizedValue !== 'occupied') {
          nextState.guests = '0';
        } else {
          const minimumGuests = Math.max(assignedCollaboratorsCount, 1);
          nextState.guests = String(minimumGuests);
        }
        return nextState;
      }

      if (field === 'capacity') {
        const nextState = { ...prev, capacity: value };
        const capacityNumber = Number(value);
        const guestsNumber = Number(prev.guests);

        if (!Number.isNaN(capacityNumber) && !Number.isNaN(guestsNumber)) {
          if (guestsNumber > capacityNumber) {
            const minGuests = prev.status === 'occupied' && capacityNumber >= 1 ? 1 : 0;
            nextState.guests = String(Math.max(capacityNumber, minGuests));
          } else if (prev.status === 'occupied' && guestsNumber < 1 && capacityNumber >= 1) {
            nextState.guests = '1';
          }
        }

        return nextState;
      }

      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleRoomEditSubmit = () => {
    const capacityValue = Number(roomEditDialog.capacity);
    const guestsValue = Number(roomEditDialog.guests);
    const allowedStatuses = ['available', 'occupied'];
    const statusValue = allowedStatuses.includes(roomEditDialog.status)
      ? roomEditDialog.status
      : 'available';
    let assignedCollaboratorCount = 0;

    if (roomEditDialog.palaceId && roomEditDialog.floorId && roomEditDialog.apartmentId && roomEditDialog.roomId) {
      const palace = palaces.find((item) => item.id === roomEditDialog.palaceId);
      const floor = palace?.floors?.find((item) => item.id === roomEditDialog.floorId);
      const apartment = floor?.apartments?.find((item) => item.id === roomEditDialog.apartmentId);
      const room = apartment?.rooms?.find((item) => item.id === roomEditDialog.roomId);

      if (room && Array.isArray(room.collaborators)) {
        assignedCollaboratorCount = room.collaborators.filter((item) => item && item.id).length;
      }
    }

    if (Number.isNaN(capacityValue) || capacityValue < 1) {
      setRoomEditError('La capacidad debe ser un número mayor o igual a 1.');
      return;
    }

    if (Number.isNaN(guestsValue) || guestsValue < 0) {
      setRoomEditError('La ocupación debe ser un número mayor o igual a 0.');
      return;
    }

    if (guestsValue > capacityValue) {
      setRoomEditError('La ocupación no puede superar la capacidad de la habitación.');
      return;
    }

    if (!allowedStatuses.includes(statusValue)) {
      setRoomEditError('Selecciona un estado válido para la habitación.');
      return;
    }

    if (statusValue === 'occupied' && assignedCollaboratorCount > capacityValue) {
      setRoomEditError('La capacidad no puede ser menor al número de colaboradores asignados.');
      return;
    }

    if (!roomEditDialog.palaceId || !roomEditDialog.floorId || !roomEditDialog.apartmentId || !roomEditDialog.roomId) {
      setRoomEditError('No se pudo identificar la habitación a actualizar.');
      return;
    }

    let normalizedGuests = guestsValue;
    if (statusValue !== 'occupied') {
      normalizedGuests = 0;
    } else if (normalizedGuests < 1) {
      normalizedGuests = Math.min(Math.max(1, normalizedGuests), capacityValue);
    }

    if (statusValue === 'occupied') {
      const minimumGuests = assignedCollaboratorCount > 0 ? assignedCollaboratorCount : 1;
      normalizedGuests = Math.max(normalizedGuests, minimumGuests);
    }

    const updates = {
      capacity: capacityValue,
      guests: normalizedGuests,
      status: statusValue,
      maintenanceNote: '',
      maintenanceZone: '',
      maintenanceAreaType: '',
      maintenanceUpdatedAt: null
    };

    updateRoomDetails(
      roomEditDialog.palaceId,
      roomEditDialog.floorId,
      roomEditDialog.apartmentId,
      roomEditDialog.roomId,
      updates
    );

    setFeedback({
      type: 'success',
  message: `Se actualizaron los detalles de ${roomEditDialog.roomName}. No olvides guardar los cambios del edificio para persistirlos.`
    });

    closeRoomEditDialog();
  };

  const roomEditContext = useMemo(() => {
    if (!roomEditDialog.open) {
      return null;
    }

    const palace = palaces.find((item) => item.id === roomEditDialog.palaceId);
    if (!palace) {
      return null;
    }

    const floor = palace.floors.find((item) => item.id === roomEditDialog.floorId);
    if (!floor) {
      return null;
    }

    const apartment = floor.apartments.find((item) => item.id === roomEditDialog.apartmentId);
    if (!apartment) {
      return null;
    }

    const room = apartment.rooms.find((item) => item.id === roomEditDialog.roomId);
    if (!room) {
      return null;
    }

    return {
      palace,
      floor,
      apartment,
      room
    };
  }, [palaces, roomEditDialog]);

  const assignedCollaboratorsCount = useMemo(() => {
    if (!roomEditContext?.room) {
      return 0;
    }

    const collaboratorsList = Array.isArray(roomEditContext.room.collaborators)
      ? roomEditContext.room.collaborators.filter((item) => item && item.id)
      : [];

    return collaboratorsList.length;
  }, [roomEditContext]);

  useEffect(() => {
    if (!roomEditDialog.open || roomEditDialog.status !== 'occupied') {
      return;
    }

    if (assignedCollaboratorsCount <= 0) {
      return;
    }

    setRoomEditDialog((prev) => {
      const desiredMinimum = Math.max(assignedCollaboratorsCount, 1);
      const currentCapacityNumber = Number(prev.capacity);
      const needsCapacityAdjustment = Number.isNaN(currentCapacityNumber) || currentCapacityNumber < desiredMinimum;
      const nextCapacity = needsCapacityAdjustment ? String(desiredMinimum) : prev.capacity;
      const nextGuests = String(desiredMinimum);

      if (!needsCapacityAdjustment && prev.guests === nextGuests) {
        return prev;
      }

      return {
        ...prev,
        capacity: nextCapacity,
        guests: nextGuests
      };
    });
  }, [assignedCollaboratorsCount, roomEditDialog.open, roomEditDialog.status]);

  const handleAddFloor = (palaceId) => {
    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) return;

  const referenceFloor = palace.floors[0];
  const apartmentsPerFloor = referenceFloor ? referenceFloor.apartments.length : 4;
  const roomsPerApartment = referenceFloor?.apartments?.[0]?.rooms?.length || 2;
    const capacity = referenceFloor?.apartments?.[0]?.rooms?.[0]?.capacity || 2;

    updatePalaceState(palaceId, (draft) => {
      const floorNumber = draft.floors.length + 1;
      draft.floors.push(
        createClientFloor({
          floorNumber,
          apartmentsPerFloor,
          roomsPerApartment,
          capacity
        })
      );
    });
  };

  const handleRemoveFloor = (palaceId, floorId) => {
    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) return;
    if (palace.floors.length <= 1) return;

    updatePalaceState(palaceId, (draft) => {
      draft.floors = draft.floors.filter((floor) => floor.id !== floorId);
    });
  };

  const handleAddApartment = (palaceId, floorId) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
  const roomsPerApartment = floor.apartments?.[0]?.rooms?.length || 2;
      const capacity = floor.apartments?.[0]?.rooms?.[0]?.capacity || 2;
      const apartmentNumber = floor.apartments.length + 1;
      floor.apartments.push(
        createClientApartment({
          floorNumber: floor.number,
          apartmentNumber,
          roomsPerApartment,
          capacity
        })
      );
    });
  };

  const handleRemoveApartment = (palaceId, floorId, apartmentId) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      if (floor.apartments.length <= 1) return;
      floor.apartments = floor.apartments.filter((apartment) => apartment.id !== apartmentId);
    });
  };

  const handleApartmentStatusChange = (palaceId, floorId, apartmentId, status) => {
    const normalizedStatus = APARTMENT_STATUS_OPTIONS.some((item) => item.value === status) ? status : 'active';
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      apartment.status = normalizedStatus;
      if (apartment.status !== 'out_of_service') {
        apartment.outOfServiceNote = '';
      }
    });
  };

  const handleApartmentNoteChange = (palaceId, floorId, apartmentId, note) => {
    const safeValue = typeof note === 'string' ? note.slice(0, 320) : '';
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      if (apartment.status !== 'out_of_service') {
        apartment.outOfServiceNote = '';
        return;
      }
      apartment.outOfServiceNote = safeValue;
    });
  };

  const handleApartmentNoteBlur = (palaceId, floorId, apartmentId, note) => {
    const trimmedValue = typeof note === 'string' ? note.trim() : '';
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      if (apartment.status !== 'out_of_service') {
        apartment.outOfServiceNote = '';
        return;
      }
      apartment.outOfServiceNote = trimmedValue;
    });
  };

  const openApartmentStatusDialogForPalace = (palaceId) => {
    setApartmentStatusDialog({ open: true, palaceId });
  };

  const closeApartmentStatusDialog = () => {
    setApartmentStatusDialog({ open: false, palaceId: null });
  };

  const handleAddRoom = (palaceId, floorId, apartmentId) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      if (apartment.status === 'out_of_service') return;
      const capacity = apartment.rooms?.[0]?.capacity || 2;
      const roomNumber = apartment.rooms.length + 1;
      apartment.rooms.push({
        id: createTempId(),
        name: `Habitación ${floor.number}${apartment.number}${roomNumber}`,
        capacity,
        guests: 0,
        status: 'available',
        collaboratorIds: [],
        collaborators: [],
        maintenanceNote: '',
        maintenanceZone: '',
        maintenanceAreaType: '',
        maintenanceUpdatedAt: null
      });
    });
  };

  const handleRemoveRoom = (palaceId, floorId, apartmentId, roomId) => {
    updatePalaceState(palaceId, (draft) => {
      const floor = draft.floors.find((item) => item.id === floorId);
      if (!floor) return;
      const apartment = floor.apartments.find((item) => item.id === apartmentId);
      if (!apartment) return;
      if (apartment.rooms.length <= 1) return;
      apartment.rooms = apartment.rooms.filter((room) => room.id !== roomId);
    });
  };

  const buildPayloadFromPalace = (palace) => ({
    id: palace.id,
    name: palace.name,
    seriesNumber: palace.seriesNumber,
    floors: palace.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      number: floor.number,
      apartments: floor.apartments.map((apartment) => ({
        id: apartment.id,
        name: apartment.name,
        number: apartment.number,
        status: APARTMENT_STATUS_OPTIONS.some((item) => item.value === apartment.status)
          ? apartment.status
          : 'active',
        outOfServiceNote:
          apartment.status === 'out_of_service' && typeof apartment.outOfServiceNote === 'string'
            ? apartment.outOfServiceNote.trim()
            : '',
        rooms: apartment.rooms.map((room) => ({
          id: room.id,
          name: room.name,
          capacity: Number(room.capacity),
          guests: Number(room.guests),
          status: room.status,
          collaboratorIds: Array.isArray(room.collaboratorIds)
            ? room.collaboratorIds.slice(0, 2)
            : room.collaboratorId
              ? [room.collaboratorId]
              : [],
          maintenanceNote: room.maintenanceNote || '',
          maintenanceZone: room.maintenanceZone || '',
          maintenanceAreaType: room.maintenanceAreaType || '',
          maintenanceUpdatedAt: room.maintenanceUpdatedAt || null
        }))
      }))
    }))
  });

  const handleSavePalace = async (palaceId) => {
    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) return;

    try {
      setSavingPalaceId(palaceId);
      const payload = buildPayloadFromPalace(palace);
      const { data } = await alojamientosAPI.updatePalace(palaceId, payload);
      const updatedPalace = data?.palace ?? data;
      setPalaces((prev) => {
        const next = prev.map((item) => (item.id === palaceId ? updatedPalace : item));
        return applyMttoReportsToPalaces(next);
      });
      setSummary(data?.summary ?? summary);
      setDirtyMap((prev) => ({ ...prev, [palaceId]: false }));
      setFeedback({ type: 'success', message: `${updatedPalace.name} guardado correctamente.` });
    } catch (err) {
      setFeedback({ type: 'error', message: handleAPIError(err) });
    } finally {
      setSavingPalaceId(null);
    }
  };

  const handleResetPalace = () => {
    fetchPalaces();
  };

  const handleDeletePalace = async (palaceId) => {
    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) return;
    if (!window.confirm(`¿Eliminar ${palace.name}?`)) return;

    try {
      await alojamientosAPI.deletePalace(palaceId);
      setFeedback({ type: 'success', message: `${palace.name} fue eliminado.` });
      fetchPalaces();
    } catch (err) {
      setFeedback({ type: 'error', message: handleAPIError(err) });
    }
  };

  const handleCreatePalace = async () => {
    try {
      const trimmedCustomName = createForm.customName?.toString().trim() || '';
      const payload = {
        seriesNumber: createForm.seriesNumber ? Number(createForm.seriesNumber) : undefined,
        floors: Number(createForm.floors),
        apartmentsPerFloor: Number(createForm.apartmentsPerFloor),
        roomsPerApartment: Number(createForm.roomsPerApartment),
        capacityPerRoom: Number(createForm.capacityPerRoom)
      };
      if (trimmedCustomName) {
        payload.customName = trimmedCustomName;
      }
      const { data } = await alojamientosAPI.createPalace(payload);
  const newPalace = data?.palace ?? data;
  setPalaces((prev) => applyMttoReportsToPalaces([...prev, newPalace]));
  setSummary(data?.summary ?? summary);
  setFeedback({ type: 'success', message: `${newPalace.name} creado correctamente.` });
  setCreateDialogOpen(false);
  setCreateForm({
    seriesNumber: '',
    floors: 3,
    apartmentsPerFloor: 4,
    roomsPerApartment: 2,
    capacityPerRoom: 2,
    customName: ''
  });
    } catch (err) {
      setFeedback({ type: 'error', message: handleAPIError(err) });
    }
  };

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Edificios PALACE',
        value: summary.totalPalaces,
        icon: BusinessIcon,
        color: 'primary.main'
      },
      {
        label: 'Pisos',
        value: summary.totalFloors,
        icon: LayersIcon,
        color: 'secondary.main'
      },
      {
        label: 'Apartamentos',
        value: summary.totalApartments,
        icon: ApartmentIcon,
        color: 'success.main'
      },
      {
        label: 'Aptos fuera de servicio',
        value: summary.apartmentsOutOfService ?? 0,
        icon: ApartmentIcon,
        color: 'warning.main'
      },
      {
        label: 'Habitaciones',
        value: summary.totalRooms,
        icon: HotelIcon,
        color: 'info.main'
      }
    ];
  }, [summary]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Gestión de Alojamientos
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Administra edificios, pisos, apartamentos y habitaciones en tiempo real.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPalaces}
          >
            Refrescar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Agregar edificio
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Collapse in={Boolean(collaboratorsError)}>
        {collaboratorsError && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <IconButton size="small" color="inherit" onClick={fetchCollaborators}>
                <RefreshIcon fontSize="inherit" />
              </IconButton>
            }
          >
            {collaboratorsError}
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

      {summaryCards.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {summaryCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.label}>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${card.color}20` }}>
                    <card.icon sx={{ color: card.color, fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.label}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {palaces.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No hay edificios configurados.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Crea el primero para comenzar a gestionar disponibilidad y ocupación.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
            onClick={() => setCreateDialogOpen(true)}
          >
            Crear edificio
          </Button>
        </Paper>
      ) : (
        palaces.map((palace) => {
          const palaceStats = getPalaceStats(palace);
          const isSaving = savingPalaceId === palace.id;
          const hasChanges = Boolean(dirtyMap[palace.id]);
          const isExpanded = Boolean(expandedPalaces[palace.id]);

          return (
            <Accordion
              key={palace.id}
              expanded={isExpanded}
              onChange={(_, expanded) => {
                setExpandedPalaces((prev) => ({
                  ...prev,
                  [palace.id]: expanded
                }));
              }}
              sx={{ mb: 2 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <BusinessIcon color="primary" />
                    <Box>
                      <Typography variant="h6">{palace.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Serie #{palace.seriesNumber} • {palace.floors.length} pisos • {palaceStats.rooms} habitaciones
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`Ocupación ${palaceStats.occupancyRate}%`}
                      color={palaceStats.occupancyRate > 70 ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    <Chip
                      label={`${palaceStats.guests}/${palaceStats.capacity} huéspedes`}
                      color="info"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip icon={<PeopleIcon />} label={`Ocupadas: ${palaceStats.occupied}`} color="primary" variant="outlined" />
                  <Chip icon={<MeetingRoomIcon />} label={`Disponibles: ${palaceStats.available}`} color="success" variant="outlined" />
                  <Chip icon={<MeetingRoomIcon />} label={`Mantenimiento: ${palaceStats.maintenance}`} color="warning" variant="outlined" />
                  <Chip icon={<ApartmentIcon />} label={`Aptos fuera de servicio: ${palaceStats.apartmentsOutOfService}`} color="warning" variant="outlined" />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="text"
                    startIcon={<AddIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddFloor(palace.id);
                    }}
                  >
                    Agregar piso
                  </Button>
                  <Button
                    variant="text"
                    startIcon={<PeopleIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAssignmentDialogForPalace(palace);
                    }}
                  >
                    Asignar colaboradores
                  </Button>
                  <Button
                    variant="text"
                    startIcon={<PersonOffIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openUnassignDialogForPalace(palace);
                    }}
                  >
                    Desasignar colaborador
                  </Button>
                  <Button
                    variant="text"
                    startIcon={<SwapHorizIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openMoveDialogForPalace(palace);
                    }}
                  >
                    Mover colaborador
                  </Button>
                  <Button
                    variant="text"
                    startIcon={<BlockIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openApartmentStatusDialogForPalace(palace.id);
                    }}
                  >
                    Gestionar apartamentos
                  </Button>
                  <Button
                    variant="text"
                    startIcon={<RefreshIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleResetPalace();
                    }}
                  >
                    Descartar cambios
                  </Button>
                  <Tooltip title="Eliminar edificio">
                    <span>
                      <Button
                        color="error"
                        variant="text"
                        startIcon={<DeleteIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeletePalace(palace.id);
                        }}
                      >
                        Eliminar edificio
                      </Button>
                    </span>
                  </Tooltip>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={!hasChanges || isSaving}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSavePalace(palace.id);
                    }}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </Stack>

                {palace.floors.map((floor) => (
                  <Paper key={floor.id} sx={{ p: 2, mb: 2 }} variant="outlined">
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LayersIcon color="primary" />
                        <Typography variant="subtitle1">{floor.name}</Typography>
                        <Chip label={`${floor.apartments.length} apartamentos`} size="small" />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddApartment(palace.id, floor.id);
                          }}
                        >
                          Agregar apartamento
                        </Button>
                        <Tooltip title="Eliminar piso">
                          <span>
                            <Button
                              size="small"
                              startIcon={<DeleteIcon />}
                              color="error"
                              disabled={palace.floors.length <= 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveFloor(palace.id, floor.id);
                              }}
                            >
                              Eliminar piso
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      {floor.apartments.map((apartment) => (
                        <Grid item xs={12} md={6} key={apartment.id}>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <ApartmentIcon color="secondary" />
                                <Typography variant="subtitle2">{apartment.name}</Typography>
                                {apartment.status === 'out_of_service' && (
                                  <Chip
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    label={getApartmentStatusLabel(apartment.status)}
                                  />
                                )}
                              </Stack>
                              <Tooltip title="Eliminar apartamento">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={floor.apartments.length <= 1}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRemoveApartment(palace.id, floor.id, apartment.id);
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>

                            {apartment.status === 'out_of_service' && (
                              <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {getApartmentStatusLabel(apartment.status)}
                                </Typography>
                                {apartment.outOfServiceNote ? (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Motivo: {apartment.outOfServiceNote}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Marca un motivo para informar al equipo.
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Actualiza este estado desde "Gestionar apartamentos".
                                </Typography>
                              </Alert>
                            )}

                            <Grid container spacing={1} sx={{ mt: 2 }}>
                              {apartment.rooms.map((room) => {
                                const collaboratorList = Array.isArray(room.collaborators)
                                  ? room.collaborators.filter((item) => item && item.id)
                                  : [];
                                const uniqueCollaborators = [];
                                const seenIds = new Set();

                                collaboratorList.forEach((item) => {
                                  if (item.id && !seenIds.has(item.id)) {
                                    seenIds.add(item.id);
                                    uniqueCollaborators.push(item);
                                  }
                                });

                                const availableSlots = Math.max(
                                  MAX_COLLABORATORS_PER_ROOM - uniqueCollaborators.length,
                                  0
                                );

                                const isHighlighted = highlightedRoomId === room.id;
                                const isApartmentOut = apartment.status === 'out_of_service';
                                const preCheckin = room.preCheckin || null;

                                const statusColor = isApartmentOut ? 'warning' : getRoomStatusColor(room.status);
                                const statusLabel = isApartmentOut ? 'Fuera de servicio' : formatRoomStatusLabel(room.status);
                                const metrics = [
                                  { label: 'Capacidad', value: `${room.capacity} personas` },
                                  { label: 'Ocupación', value: `${room.guests} personas` },
                                  {
                                    label: 'Disponibilidad',
                                    value: isApartmentOut
                                      ? 'Fuera de servicio'
                                      : availableSlots === 0
                                        ? 'Sin cupos disponibles'
                                        : availableSlots === 1
                                          ? '1 cupo disponible'
                                          : `${availableSlots} cupos disponibles`,
                                    valueColor: isApartmentOut
                                      ? 'warning.main'
                                      : availableSlots > 0
                                        ? 'success.main'
                                        : 'text.secondary'
                                  }
                                ];

                                  if (preCheckin) {
                                    metrics.push({
                                      label: 'Pre-ingreso',
                                      value: new Date(preCheckin.checkinDate).toLocaleString('es-ES', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                      }),
                                      valueColor: 'warning.main'
                                    });
                                  }

                                return (
                                  <Grid item xs={12} key={room.id}>
                                    <Paper
                                      id={`room-card-${room.id}`}
                                      variant="outlined"
                                      sx={{
                                        p: 2,
                                        borderWidth: 1,
                                        borderStyle: 'solid',
                                        borderColor: isHighlighted ? 'primary.main' : 'divider',
                                        boxShadow: isHighlighted ? '0 0 0 2px rgba(79, 70, 229, 0.18)' : 'none',
                                        backgroundColor: (theme) =>
                                          isHighlighted
                                            ? 'rgba(79, 70, 229, 0.04)'
                                            : theme.palette.background.paper,
                                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease'
                                      }}
                                    >
                                      <Stack
                                        direction={{ xs: 'column', md: 'row' }}
                                        spacing={2}
                                        alignItems={{ xs: 'flex-start', md: 'center' }}
                                      >
                                        <Stack spacing={1.5} sx={{ minWidth: { xs: '100%', md: 260 } }}>
                                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <MeetingRoomIcon color="info" />
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              {room.name}
                                            </Typography>
                                            <Chip
                                              size="small"
                                              color={statusColor === 'default' ? undefined : statusColor}
                                              variant={statusColor === 'default' ? 'outlined' : 'filled'}
                                              label={statusLabel}
                                            />
                                            {preCheckin ? (
                                              <Chip
                                                size="small"
                                                color="warning"
                                                variant="outlined"
                                                label="Pre-asignada"
                                              />
                                            ) : null}
                                            <Chip
                                              size="small"
                                              icon={<PeopleIcon fontSize="small" />}
                                              label={`${uniqueCollaborators.length}/${MAX_COLLABORATORS_PER_ROOM} colaboradores`}
                                              variant="outlined"
                                            />
                                          </Stack>
                                          <Stack direction="row" spacing={1} flexWrap="wrap">
                                            {metrics.map((metric) => (
                                              <Paper key={metric.label} variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 1.5 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                  {metric.label}
                                                </Typography>
                                                <Typography
                                                  variant="body2"
                                                  sx={{ fontWeight: 600, color: metric.valueColor || 'text.primary' }}
                                                >
                                                  {metric.value}
                                                </Typography>
                                              </Paper>
                                            ))}
                                          </Stack>
                                          {room.status === 'maintenance' && (
                                            <Alert
                                              severity="warning"
                                              variant="outlined"
                                              sx={{ mt: 1, alignItems: 'flex-start' }}
                                            >
                                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {room.maintenanceNote || 'Habitación en mantenimiento'}
                                              </Typography>
                                              {(room.maintenanceZone || room.maintenanceAreaType) && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  {[room.maintenanceZone ? `Zona reportada: ${room.maintenanceZone}` : null,
                                                    room.maintenanceAreaType ? `Área: ${getMaintenanceAreaLabel(room.maintenanceAreaType)}` : null]
                                                    .filter(Boolean)
                                                    .join(' • ')}
                                                </Typography>
                                              )}
                                              <Typography variant="caption" color="text.secondary">
                                                {formatMaintenanceTimestamp(room.maintenanceUpdatedAt)}
                                              </Typography>
                                            </Alert>
                                          )}
                                          {preCheckin ? (
                                            <Alert severity="info" variant="outlined" sx={{ mt: 1, alignItems: 'flex-start' }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                Pre-ingreso programado
                                                {preCheckin.guestName ? ` para ${preCheckin.guestName}` : ''}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" display="block">
                                                Ingreso: {new Date(preCheckin.checkinDate).toLocaleString('es-ES', {
                                                  dateStyle: 'medium',
                                                  timeStyle: 'short'
                                                })}
                                              </Typography>
                                              {preCheckin.notes ? (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  Nota: {preCheckin.notes}
                                                </Typography>
                                              ) : null}
                                            </Alert>
                                          ) : null}
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              openRoomEditDialog(palace, floor, apartment, room);
                                            }}
                                            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                                          >
                                            Editar detalles
                                          </Button>
                                        </Stack>
                                        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', md: 280 } }}>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            Detalle de colaboradores
                                          </Typography>
                                          {uniqueCollaborators.length > 0 ? (
                                            <Stack spacing={1.25} sx={{ mt: 1 }}>
                                              {uniqueCollaborators.map((item) => (
                                                <Paper
                                                  key={item.id}
                                                  variant="outlined"
                                                  sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50' }}
                                                >
                                                  <Stack spacing={0.5}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                      {item.codigo} • {item.nombre} {item.apellido}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                      Departamento: {item.departamento || 'Sin especificar'}
                                                    </Typography>
                                                    {item.posicion && (
                                                      <Typography variant="caption" color="text.secondary" display="block">
                                                        Posición: {item.posicion}
                                                      </Typography>
                                                    )}
                                                  </Stack>
                                                </Paper>
                                              ))}
                                            </Stack>
                                          ) : (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                                              Sin colaboradores asignados
                                            </Typography>
                                          )}
                                        </Box>
                                        <Tooltip title="Eliminar habitación">
                                          <span>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              disabled={apartment.rooms.length <= 1}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                handleRemoveRoom(palace.id, floor.id, apartment.id, room.id);
                                              }}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                      </Stack>
                                    </Paper>
                                  </Grid>
                                );
                              })}
                            </Grid>

                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              sx={{ mt: 1 }}
                              disabled={apartment.status === 'out_of_service'}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAddRoom(palace.id, floor.id, apartment.id);
                              }}
                            >
                              Agregar habitación
                            </Button>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
      <Dialog
        open={apartmentStatusDialog.open}
        onClose={closeApartmentStatusDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {apartmentStatusDialogContext?.name
            ? `Gestionar apartamentos • ${apartmentStatusDialogContext.name}`
            : 'Gestionar apartamentos'}
        </DialogTitle>
        <DialogContent dividers>
          {apartmentStatusDialogContext ? (
            apartmentStatusDialogContext.floors.some((floor) => (floor.apartments || []).length > 0) ? (
              <Stack spacing={2.5}>
                {apartmentStatusDialogContext.floors.map((floor) => {
                  const floorApartments = floor.apartments || [];
                  if (floorApartments.length === 0) {
                    return null;
                  }

                  return (
                    <Box key={floor.id}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      {floor.name}
                    </Typography>
                    <Stack spacing={1.5}>
                      {floorApartments.map((apartment) => (
                        <Paper key={apartment.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            justifyContent="space-between"
                          >
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <ApartmentIcon color="secondary" />
                              <Typography variant="subtitle2">{apartment.name}</Typography>
                              <Chip
                                size="small"
                                color={apartment.status === 'out_of_service' ? 'warning' : 'success'}
                                variant="outlined"
                                label={getApartmentStatusLabel(apartment.status)}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {apartment.rooms.length} habitaciones
                            </Typography>
                          </Stack>
                          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                            <FormControl size="small" sx={{ maxWidth: { xs: '100%', sm: 260 } }} fullWidth>
                              <InputLabel id={`dialog-apartment-status-${apartment.id}`}>Estado</InputLabel>
                              <Select
                                labelId={`dialog-apartment-status-${apartment.id}`}
                                value={apartment.status || 'active'}
                                label="Estado"
                                onChange={(event) =>
                                  handleApartmentStatusChange(
                                    apartmentStatusDialogContext.id,
                                    floor.id,
                                    apartment.id,
                                    event.target.value
                                  )
                                }
                              >
                                {APARTMENT_STATUS_OPTIONS.map((option) => (
                                  <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {apartment.status === 'out_of_service' && (
                              <TextField
                                label="Nota de fuera de servicio"
                                size="small"
                                value={apartment.outOfServiceNote || ''}
                                onChange={(event) =>
                                  handleApartmentNoteChange(
                                    apartmentStatusDialogContext.id,
                                    floor.id,
                                    apartment.id,
                                    event.target.value
                                  )
                                }
                                onBlur={(event) =>
                                  handleApartmentNoteBlur(
                                    apartmentStatusDialogContext.id,
                                    floor.id,
                                    apartment.id,
                                    event.target.value
                                  )
                                }
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="Describe el motivo"
                              />
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                  );
                })}
              </Stack>
            ) : (
              <Alert severity="info">No hay apartamentos registrados en este edificio.</Alert>
            )
          ) : (
            <Alert severity="info">Selecciona un edificio para administrar sus apartamentos.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeApartmentStatusDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignmentDialog.open}
        onClose={closeAssignmentDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {assignmentDialog.mode === 'move'
            ? `Mover colaborador${moverNameLabel ? ` • ${moverNameLabel}` : ''}`
            : assignmentDialog.palaceName
              ? `Asignar colaboradores • ${assignmentDialog.palaceName}`
              : 'Asignar colaboradores'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {assignmentDialog.mode === 'move'
                  ? `Selecciona la nueva habitación en ${assignmentDialog.palaceName || 'el edificio'} para ${moverNameLabel || 'el colaborador'}. Cada habitación permite hasta ${MAX_COLLABORATORS_PER_ROOM} colaboradores.`
                  : `Selecciona una habitación de ${assignmentDialog.palaceName || 'el edificio'} con cupos disponibles y asigna hasta ${MAX_COLLABORATORS_PER_ROOM} colaboradores activos.`}
              </Typography>
              {assignmentDialog.mode === 'move' && sourceLocationLabel && (
                <Typography variant="caption" color="text.secondary">
                  Ubicación actual: {sourceLocationLabel}
                </Typography>
              )}
            </Stack>

            {assignmentDialog.mode === 'move' && (
              moveAssignmentOptions.length > 0 ? (
                <Autocomplete
                  options={moveAssignmentOptions}
                  value={selectedMoveAssignment}
                  onChange={(event, newValue) => handleSelectMoveAssignment(newValue || null)}
                  getOptionLabel={(option) => {
                    if (!option || typeof option !== 'object') {
                      return '';
                    }
                    const collaborator = option.collaborator || {};
                    const fullName = `${collaborator.nombre || ''} ${collaborator.apellido || ''}`.trim();
                    const collaboratorLabel = fullName || collaborator.codigo || 'Colaborador';
                    return `${collaboratorLabel} • ${option.assignment.roomName}`;
                  }}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  renderOption={(props, option) => {
                    const collaborator = option.collaborator || {};
                    const fullName = `${collaborator.nombre || ''} ${collaborator.apellido || ''}`.trim();
                    const collaboratorLabel = fullName || collaborator.codigo || 'Colaborador';
                    return (
                      <li {...props} key={option.key}>
                        <Stack spacing={0.25} sx={{ width: '100%' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {collaboratorLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.assignment.roomName} • {option.assignment.apartmentName} • {option.assignment.floorName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Estado actual: {formatRoomStatusLabel(option.assignment.roomStatus)}
                          </Typography>
                          {option.assignment.apartmentStatus === 'out_of_service' && (
                            <Typography variant="caption" color="warning.main">
                              Apartamento fuera de servicio
                              {option.assignment.apartmentNote ? ` • Motivo: ${option.assignment.apartmentNote}` : ''}
                            </Typography>
                          )}
                        </Stack>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Colaborador a mover"
                      placeholder="Selecciona el colaborador a mover"
                    />
                  )}
                />
              ) : (
                <Alert severity="info">
                  No hay colaboradores asignados en este edificio para mover.
                </Alert>
              )
            )}

            {assignmentRooms.length === 0 ? (
              <Alert severity="info">
                No hay habitaciones disponibles para asignar colaboradores en este edificio.
              </Alert>
            ) : (
              <>
                <Autocomplete
                  options={assignmentRooms}
                  value={selectedAssignmentRoom}
                  onChange={(event, newValue) => handleSelectAssignmentRoom(newValue ? newValue.id : null)}
                  getOptionLabel={(option) => `${option.name} • ${option.apartmentName} • ${option.floorName}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionDisabled={(option) => {
                    const noSlots = option.availableSlots === 0 && option.id !== assignmentDialog.roomId;
                    const isOriginRoom = assignmentDialog.mode === 'move' && option.id === assignmentDialog.sourceRoomId;
                    return noSlots || isOriginRoom;
                  }}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack spacing={0.25} sx={{ width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.apartmentName} • {option.floorName} • {formatRoomStatusLabel(option.status)}
                        </Typography>
                        {option.status === 'maintenance' && (() => {
                          const parts = [
                            option.maintenanceZone ? `Zona: ${option.maintenanceZone}` : null,
                            option.maintenanceAreaType ? `Área: ${getMaintenanceAreaLabel(option.maintenanceAreaType)}` : null,
                            option.maintenanceNote ? `Nota: ${option.maintenanceNote}` : null
                          ].filter(Boolean);

                          if (parts.length === 0) {
                            return null;
                          }

                          return (
                            <Typography variant="caption" color="warning.main">
                              {parts.join(' • ')}
                            </Typography>
                          );
                        })()}
                        <Typography
                          variant="caption"
                          color={option.availableSlots > 0 ? 'success.main' : 'text.secondary'}
                        >
                          {option.collaborators.length}/{MAX_COLLABORATORS_PER_ROOM} colaboradores asignados
                        </Typography>
                      </Stack>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={assignmentDialog.mode === 'move' ? 'Habitación destino' : 'Habitación'}
                      placeholder={assignmentDialog.mode === 'move' ? 'Buscar habitación destino' : 'Buscar habitación'}
                    />
                  )}
                  clearOnEscape
                />

                {selectedAssignmentRoom && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Typography variant="subtitle2">{selectedAssignmentRoom.name}</Typography>
                        <Chip label={formatRoomStatusLabel(selectedAssignmentRoom.status)} size="small" />
                        <Chip
                          label={`${selectedAssignmentRoom.collaborators.length}/${MAX_COLLABORATORS_PER_ROOM} colaboradores`}
                          size="small"
                          color={selectedAssignmentRoom.availableSlots > 0 ? 'success' : 'default'}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color={selectedAssignmentRoom.availableSlots > 0 ? 'success.main' : 'text.secondary'}
                      >
                        {selectedAssignmentRoom.availableSlots === 1
                          ? '1 cupo disponible'
                          : `${selectedAssignmentRoom.availableSlots} cupos disponibles`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedAssignmentRoom.apartmentName} • {selectedAssignmentRoom.floorName}
                      </Typography>
                      {selectedAssignmentRoom.status === 'maintenance' && (() => {
                        const maintenanceDetails = [
                          selectedAssignmentRoom.maintenanceZone
                            ? `Zona: ${selectedAssignmentRoom.maintenanceZone}`
                            : null,
                          getMaintenanceAreaLabel(selectedAssignmentRoom.maintenanceAreaType)
                            ? `Área: ${getMaintenanceAreaLabel(selectedAssignmentRoom.maintenanceAreaType)}`
                            : null,
                          selectedAssignmentRoom.maintenanceNote
                            ? `Nota: ${selectedAssignmentRoom.maintenanceNote}`
                            : null
                        ].filter(Boolean);

                        if (maintenanceDetails.length === 0) {
                          return null;
                        }

                        return (
                          <Typography variant="caption" color="warning.main">
                            {maintenanceDetails.join(' • ')}
                          </Typography>
                        );
                      })()}
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        {selectedAssignmentRoom.collaborators.map((item) => (
                          <Chip key={item.id} label={`${item.nombre} ${item.apellido}`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                        {selectedAssignmentRoom.collaborators.length === 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Sin colaboradores asignados actualmente.
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                )}

                <Autocomplete
                  multiple
                  options={collaboratorOptions}
                  value={assignmentDialog.selectedCollaborators}
                  onChange={(event, newValue) => handleAssignmentCollaboratorChange(newValue)}
                  getOptionLabel={(option) => `${option.codigo} • ${option.nombre} ${option.apellido}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  loading={loadingCollaborators}
                  noOptionsText={loadingCollaborators ? 'Cargando colaboradores...' : 'No hay colaboradores disponibles'}
                  loadingText="Cargando colaboradores..."
                  filterSelectedOptions
                  limitTags={MAX_COLLABORATORS_PER_ROOM}
                  disabled={assignmentDialog.mode === 'move'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={assignmentDialog.mode === 'move' ? 'Colaborador a mover' : 'Colaboradores a asignar'}
                      placeholder={assignmentDialog.mode === 'move' ? 'Selecciona el colaborador en la lista superior' : 'Selecciona colaboradores'}
                      helperText={assignmentDialog.mode === 'move'
                        ? 'La selección se controla desde la lista de colaboradores asignados.'
                        : `Máximo ${MAX_COLLABORATORS_PER_ROOM} colaboradores por habitación`}
                    />
                  )}
                />
              </>
            )}

            {assignmentError && <Alert severity="error">{assignmentError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignmentDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAssignmentSubmit}
            disabled={
              !assignmentDialog.roomId ||
              assignmentRooms.length === 0 ||
              (assignmentDialog.mode === 'move' && !assignmentDialog.movingCollaborator)
            }
          >
            {assignmentDialog.mode === 'move' ? 'Mover colaborador' : 'Guardar asignación'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unassignDialog.open} onClose={closeUnassignDialog} fullWidth maxWidth="sm">
        <DialogTitle>Desasignar colaborador</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Selecciona el colaborador y la habitación que deseas liberar en {unassignDialog.palaceName || 'el edificio'}.
            </Typography>
            <Autocomplete
              options={unassignDialog.options}
              value={unassignDialog.selectedOption}
              onChange={(event, newValue) => handleSelectUnassignOption(newValue)}
              getOptionLabel={(option) => {
                if (!option) {
                  return '';
                }
                const name = [option.collaborator?.nombre, option.collaborator?.apellido]
                  .filter(Boolean)
                  .join(' ');
                const fallback = option.collaborator?.codigo || 'Colaborador';
                const roomLabel = option.assignment?.roomName || 'Habitación sin nombre';
                return `${name || fallback} • ${roomLabel}`;
              }}
              isOptionEqualToValue={(option, value) => option.key === value?.key}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Colaborador asignado"
                  placeholder="Busca por nombre, código o habitación"
                />
              )}
              disabled={unassignDialog.options.length === 0}
            />
            {unassignDialog.selectedOption && (
              <Alert severity="info" variant="outlined">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {`${[unassignDialog.selectedOption.collaborator?.nombre, unassignDialog.selectedOption.collaborator?.apellido]
                    .filter(Boolean)
                    .join(' ') || unassignDialog.selectedOption.collaborator?.codigo || 'Colaborador'}`}
                </Typography>
                <Typography variant="body2">
                  Habitación: {unassignDialog.selectedOption.assignment?.roomName || 'Sin nombre'}
                </Typography>
                <Typography variant="body2">
                  Ubicación:{' '}
                  {[unassignDialog.selectedOption.assignment?.apartmentName, unassignDialog.selectedOption.assignment?.floorName]
                    .filter(Boolean)
                    .join(' • ') || 'No disponible'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Estado actual: {formatRoomStatusLabel(unassignDialog.selectedOption.assignment?.roomStatus)}
                </Typography>
              </Alert>
            )}
            {unassignDialog.error && (
              <Alert severity="error" onClose={() => setUnassignDialog((prev) => ({ ...prev, error: null }))}>
                {unassignDialog.error}
              </Alert>
            )}
            {unassignDialog.options.length === 0 && (
              <Alert severity="info" variant="outlined">
                No hay colaboradores asignados en este edificio.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUnassignDialog}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmUnassign}
            disabled={!unassignDialog.selectedOption}
          >
            Desasignar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={roomEditDialog.open}
        onClose={closeRoomEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {roomEditDialog.roomName ? `Editar ${roomEditDialog.roomName}` : 'Editar habitación'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {roomEditContext?.palace && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {roomEditContext.palace.name} • {roomEditContext.floor.name} • {roomEditContext.apartment.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="small"
                    color={getRoomStatusColor(roomEditDialog.status) === 'default' ? undefined : getRoomStatusColor(roomEditDialog.status)}
                    variant={getRoomStatusColor(roomEditDialog.status) === 'default' ? 'outlined' : 'filled'}
                    label={formatRoomStatusLabel(roomEditDialog.status)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Capacidad registrada: {roomEditContext.room.capacity} personas
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ocupación registrada: {roomEditContext.room.guests} personas
                  </Typography>
                </Stack>
              </Stack>
            )}

            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                label="Estado"
                value={roomEditDialog.status}
                onChange={(event) => handleRoomEditInputChange('status', event.target.value)}
              >
                <MenuItem value="available">Disponible</MenuItem>
                <MenuItem value="occupied">Ocupado</MenuItem>
              </Select>
            </FormControl>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Capacidad"
                type="number"
                value={roomEditDialog.capacity}
                onChange={(event) => handleRoomEditInputChange('capacity', event.target.value)}
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                label="Ocupación"
                type="number"
                value={roomEditDialog.guests}
                onChange={(event) => handleRoomEditInputChange('guests', event.target.value)}
                inputProps={{
                  min:
                    roomEditDialog.status === 'occupied' && assignedCollaboratorsCount > 0
                      ? assignedCollaboratorsCount
                      : 0,
                  max: Number(roomEditDialog.capacity) || undefined
                }}
                disabled={roomEditDialog.status !== 'occupied'}
                InputProps={{
                  readOnly: roomEditDialog.status === 'occupied' && assignedCollaboratorsCount > 0
                }}
                helperText={
                  roomEditDialog.status !== 'occupied'
                    ? 'La ocupación se ajusta automáticamente cuando la habitación no está ocupada.'
                    : assignedCollaboratorsCount > 0
                      ? `Colaboradores asignados ocupando la habitación: ${assignedCollaboratorsCount}`
                      : 'Ingresa la cantidad de personas ocupando la habitación.'
                }
                fullWidth
              />
            </Stack>

            {roomEditError && <Alert severity="error">{roomEditError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoomEditDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleRoomEditSubmit}>
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear nuevo edificio</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre personalizado"
              value={createForm.customName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, customName: event.target.value }))}
              helperText="Opcional. Si lo completas, se asignará exactamente este nombre."
            />
            <TextField
              label="Serie"
              type="number"
              value={createForm.seriesNumber}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, seriesNumber: event.target.value }))}
              helperText="Opcional. Se asignará automáticamente si se deja vacío."
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Pisos"
                type="number"
                value={createForm.floors}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, floors: event.target.value }))}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Apartamentos por piso"
                type="number"
                value={createForm.apartmentsPerFloor}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, apartmentsPerFloor: event.target.value }))}
                inputProps={{ min: 1 }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Habitaciones por apartamento"
                type="number"
                value={createForm.roomsPerApartment}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, roomsPerApartment: event.target.value }))}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Capacidad por habitación"
                type="number"
                value={createForm.capacityPerRoom}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, capacityPerRoom: event.target.value }))}
                inputProps={{ min: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreatePalace}>
            Crear edificio
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Alojamientos;

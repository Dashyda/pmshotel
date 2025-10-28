const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const MAINTENANCE_AREA_TYPES = ['room', 'bathroom', 'common'];
const MAINTENANCE_AREA_LABELS = {
  room: 'Habitación',
  bathroom: 'Baños',
  common: 'Zona común'
};
const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning'];
const APARTMENT_STATUSES = ['active', 'out_of_service'];
const DEFAULT_NAMESPACE_KEY = 'tenant_default';
const COSTADORADA_NAMESPACE_KEY = 'tenant_costadorada';

const normalizeNamespaceKey = (namespace) => {
  const raw = typeof namespace === 'string' ? namespace.trim() : '';
  return raw ? raw.toLowerCase() : DEFAULT_NAMESPACE_KEY;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const createEmptyTenantDataset = () => ({
  palaces: [],
  collaborators: [],
  collaboratorMovements: []
});

const tenantDatasets = new Map();

const ensureTenantDataset = (namespace, seedFromDefault = false) => {
  const key = normalizeNamespaceKey(namespace);
  if (tenantDatasets.has(key)) {
    return tenantDatasets.get(key);
  }
  if (seedFromDefault && tenantDatasets.has(DEFAULT_NAMESPACE_KEY)) {
    const defaultDataset = tenantDatasets.get(DEFAULT_NAMESPACE_KEY);
    const cloned = {
      palaces: deepClone(defaultDataset.palaces),
      collaborators: deepClone(defaultDataset.collaborators),
      collaboratorMovements: deepClone(defaultDataset.collaboratorMovements)
    };
    tenantDatasets.set(key, cloned);
    return cloned;
  }
  const dataset = createEmptyTenantDataset();
  tenantDatasets.set(key, dataset);
  return dataset;
};

const resolveNamespaceFromRequest = (req) => {
  const headerNamespace = req?.headers?.['x-tenant-namespace'] || req?.headers?.tenantnamespace;
  const authHeader = req?.headers?.authorization || '';

  let resolvedFromToken = DEFAULT_NAMESPACE_KEY;
  let tokenRole = null;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        resolvedFromToken = normalizeNamespaceKey(decoded?.namespace || decoded?.tenant || decoded?.ns);
        tokenRole = typeof decoded?.rol === 'string' ? decoded.rol.toLowerCase() : null;
      } catch (error) {
        resolvedFromToken = DEFAULT_NAMESPACE_KEY;
        tokenRole = null;
      }
    }
  }

  if (headerNamespace) {
    const normalizedHeader = normalizeNamespaceKey(headerNamespace);
    if (tokenRole === 'super_admin' || normalizedHeader === resolvedFromToken) {
      return normalizedHeader;
    }
  }

  return resolvedFromToken;
};

const runWithTenantContext = async (namespace, handler) => {
  const key = normalizeNamespaceKey(namespace);
  const defaultDataset = tenantDatasets.get(DEFAULT_NAMESPACE_KEY);
  if (!defaultDataset) {
    throw new Error('Default tenant dataset not initialized');
  }

  if (key === DEFAULT_NAMESPACE_KEY) {
    const result = await handler({ dataset: defaultDataset, namespace: key });
    defaultDataset.palaces = palaces;
    defaultDataset.collaborators = collaborators;
    defaultDataset.collaboratorMovements = collaboratorMovements;
    return result;
  }

  const dataset = ensureTenantDataset(key);

  // Backup current global references
  const backup = {
    palaces,
    collaborators,
    collaboratorMovements
  };

  palaces = dataset.palaces;
  collaborators = dataset.collaborators;
  collaboratorMovements = dataset.collaboratorMovements;

  try {
    const result = await handler({ dataset, namespace: key });
    dataset.palaces = palaces;
    dataset.collaborators = collaborators;
    dataset.collaboratorMovements = collaboratorMovements;
    return result;
  } finally {
    palaces = backup.palaces;
    collaborators = backup.collaborators;
    collaboratorMovements = backup.collaboratorMovements;
  }
};

const respondWithTenantContext = (req, res, handler) => {
  const namespace = resolveNamespaceFromRequest(req);
  return runWithTenantContext(namespace, handler).catch((error) => {
    console.error('Error procesando la solicitud multi-tenant:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error interno del servidor de demostración.' });
    }
  });
};

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS bloqueado para el origen: ${origin}`);
    return callback(new Error('Origen no permitido por CORS')); // Bloquea otros orígenes
  },
  credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
});

// Usuarios de prueba (soporta multi-tenant)
const baseDemoUsers = [
  {
    id: 1,
    email: 'admin@pms.com',
    username: 'superadmin',
    password: 'admin123',
    nombre: 'Administrador del Sistema',
    rol: 'super_admin',
    namespace: 'tenant_default'
  },
  {
    id: 2,
    email: 'admin@costadoradapremium.com',
    username: 'admin',
    password: 'moonpalace',
    nombre: 'Administrador Costa Dorada',
    rol: 'admin',
    namespace: 'tenant_costadorada'
  }
];

const shouldSeedDemoUsers = String(
  process.env.SEED_DEMO_USERS ??
  process.env.SEED_DEMO_ADMIN ??
  ''
)
  .trim()
  .toLowerCase() === 'true';

const demoUsers = shouldSeedDemoUsers ? [...baseDemoUsers] : [];

if (shouldSeedDemoUsers) {
  console.log('👥 Credenciales demo cargadas (SEED_DEMO_USERS=true).');
} else {
  console.log('ℹ️ El servidor demo inicia sin usuarios precargados. Usa /api/admin/tenants para registrar uno.');
}

let nextDemoUserId = demoUsers.length + 1;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const registerTenantDemoUser = ({ namespace, hotelName, contactEmail, password, contactName }) => {
  const rawNamespace = normalizeString(namespace);
  const rawEmail = normalizeString(contactEmail);
  const safeNamespace = rawNamespace.toLowerCase();
  const safeEmail = rawEmail.toLowerCase();
  const safePassword = normalizeString(password);

  if (!safeNamespace || !safeEmail || !safePassword) {
    return { error: 'missing_fields' };
  }

  const duplicate = demoUsers.find((user) => {
    const userEmail = normalizeString(user.email).toLowerCase();
    const namespaces = [normalizeString(user.namespace).toLowerCase(), normalizeString(user.username).toLowerCase()];
    return userEmail === safeEmail || namespaces.includes(safeNamespace);
  });

  if (duplicate) {
    return { error: 'duplicate', user: duplicate };
  }

  const label = normalizeString(hotelName) || safeNamespace;
  const contactLabel = normalizeString(contactName);

  const newUser = {
    id: nextDemoUserId++,
    email: rawEmail,
    username: rawNamespace || safeNamespace,
    password: safePassword,
    nombre: contactLabel ? `${contactLabel} (${label})` : `Administrador ${label}`,
    rol: 'admin',
    namespace: rawNamespace || safeNamespace
  };

  demoUsers.push(newUser);
  ensureTenantDataset(newUser.namespace);
  return { user: newUser };
};

const removeTenantDemoUser = (namespace) => {
  const safeNamespace = normalizeString(namespace).toLowerCase();
  if (!safeNamespace) {
    return { error: 'missing_namespace' };
  }
  if (safeNamespace === 'tenant_default') {
    return { error: 'protected' };
  }
  const index = demoUsers.findIndex((user) => normalizeString(user.namespace).toLowerCase() === safeNamespace);
  if (index === -1) {
    return { error: 'not_found' };
  }
  const [removed] = demoUsers.splice(index, 1);
  if (tenantDatasets.has(safeNamespace)) {
    tenantDatasets.delete(safeNamespace);
  }
  return { user: removed };
};

const findDemoUser = (identifier) => {
  if (!identifier) {
    return null;
  }
  const normalized = String(identifier).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return demoUsers.find((user) =>
    [user.email, user.username]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
      .includes(normalized)
  ) || null;
};

// JWT Secret
const JWT_SECRET = 'demo_secret_key_2025';

// =========================================
// Helpers y datos de alojamientos (Edificios)
// =========================================
let sequence = 1;
const generateId = (prefix = 'id') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const incremental = (sequence++).toString(36);
  return `${prefix}_${timestamp}${randomPart}_${incremental}`;
};

const ensurePositiveInt = (value, fallback) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return Math.floor(numberValue);
};

const createRoom = ({
  floorNumber,
  apartmentNumber,
  roomIndex,
  capacity = 2,
  guests,
  status,
  collaboratorId = null
}) => {
  const safeCapacity = ensurePositiveInt(capacity, 2);
  const normalizedGuests = typeof guests === 'number' ? Math.max(Math.min(guests, safeCapacity), 0) : 0;
  const statusRaw = typeof status === 'string' ? status.trim().toLowerCase() : '';
  const resolvedStatus = ROOM_STATUSES.includes(statusRaw)
    ? statusRaw
    : normalizedGuests > 0
      ? 'occupied'
      : 'available';
  const resolvedCollaboratorIds = collaboratorId ? [collaboratorId] : [];

  return {
    id: generateId('room'),
    name: `Habitación ${floorNumber}${apartmentNumber}${roomIndex + 1}`,
    capacity: safeCapacity,
    guests: normalizedGuests,
    status: resolvedStatus,
    collaboratorIds: resolvedCollaboratorIds,
    maintenanceNote: '',
    maintenanceZone: '',
    maintenanceAreaType: '',
    maintenanceUpdatedAt: null,
    preCheckin: null
  };
};

const createApartment = ({
  floorNumber,
  apartmentIndex,
  roomsPerApartment,
  capacityPerRoom
}) => {
  const apartmentNumber = apartmentIndex + 1;
  const rooms = Array.from({ length: roomsPerApartment }).map((_, roomIndex) =>
    createRoom({
      floorNumber,
      apartmentNumber,
      roomIndex,
      capacity: Array.isArray(capacityPerRoom) ? capacityPerRoom[roomIndex] || 2 : capacityPerRoom
    })
  );

  return {
    id: generateId('apto'),
    name: `Apartamento ${floorNumber}${String.fromCharCode(65 + apartmentIndex)}`,
    number: apartmentNumber,
    status: 'active',
    outOfServiceNote: '',
    rooms
  };
};

const createFloor = ({
  floorIndex,
  apartmentsPerFloor,
  roomsPerApartment,
  capacityPerRoom
}) => {
  const floorNumber = floorIndex + 1;
  const apartments = Array.from({ length: apartmentsPerFloor }).map((_, apartmentIdx) =>
    createApartment({
      floorNumber,
      apartmentIndex: apartmentIdx,
      roomsPerApartment,
      capacityPerRoom
    })
  );

  return {
    id: generateId('floor'),
    name: `Piso ${floorNumber}`,
    number: floorNumber,
    apartments
  };
};

const normalizeRoomToAvailable = (room) => ({
  ...room,
  guests: 0,
  status: 'available',
  collaboratorIds: [],
  maintenanceNote: '',
  maintenanceZone: '',
  maintenanceAreaType: '',
  maintenanceUpdatedAt: null,
  preCheckin: null
});

const ensurePalaceFullyAvailable = (palace) => ({
  ...palace,
  floors: palace.floors.map((floor) => ({
    ...floor,
    apartments: floor.apartments.map((apartment) => ({
      ...apartment,
      status: 'active',
      outOfServiceNote: '',
      rooms: apartment.rooms.map(normalizeRoomToAvailable)
    }))
  }))
});

const createPalace = ({
  seriesNumber,
  floors = 3,
  apartmentsPerFloor = 4,
  roomsPerApartment = 2,
  capacityPerRoom = 2,
  namePrefix = 'Edificio',
  customName = ''
}) => {
  const normalizedSeries = ensurePositiveInt(seriesNumber, 1);
  const palaceId = generateId('palace');
  const trimmedCustomName = typeof customName === 'string' ? customName.trim() : '';
  const trimmedPrefix = typeof namePrefix === 'string' && namePrefix.trim() ? namePrefix.trim() : 'Edificio';
  const palaceName = trimmedCustomName || `${trimmedPrefix} ${normalizedSeries.toString().padStart(2, '0')}`;

  const floorsData = Array.from({ length: floors }).map((_, floorIndex) =>
    createFloor({
      floorIndex,
      apartmentsPerFloor,
      roomsPerApartment,
      capacityPerRoom
    })
  );

  const palace = {
    id: palaceId,
    name: palaceName,
    seriesNumber: normalizedSeries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    floors: floorsData
  };

  return ensurePalaceFullyAvailable(palace);
};

const sanitizePreCheckin = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const guestNameRaw = typeof value.guestName === 'string' ? value.guestName.trim() : '';
  const notesRaw = typeof value.notes === 'string' ? value.notes.trim() : '';
  const dateSource = value.checkinDate || value.date || value.scheduledAt;
  const parsedDate = dateSource ? new Date(dateSource) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    guestName: guestNameRaw || null,
    checkinDate: parsedDate.toISOString(),
    notes: notesRaw
  };
};

const sanitizeRoom = (room) => {
  const safeCapacity = ensurePositiveInt(room.capacity, 2);
  const maintenanceNoteRaw = typeof room.maintenanceNote === 'string' ? room.maintenanceNote.trim() : '';
  const maintenanceZoneRaw = typeof room.maintenanceZone === 'string' ? room.maintenanceZone.trim() : '';
  const maintenanceAreaTypeRaw = typeof room.maintenanceAreaType === 'string' ? room.maintenanceAreaType.trim().toLowerCase() : '';
  const maintenanceAreaType = MAINTENANCE_AREA_TYPES.includes(maintenanceAreaTypeRaw) ? maintenanceAreaTypeRaw : '';
  const maintenanceDate = room.maintenanceUpdatedAt ? new Date(room.maintenanceUpdatedAt) : null;
  const maintenanceUpdatedAt = maintenanceDate && !Number.isNaN(maintenanceDate.getTime())
    ? maintenanceDate.toISOString()
    : null;
  const candidateSources = [];

  if (Array.isArray(room.collaboratorIds)) {
    candidateSources.push(...room.collaboratorIds);
  }

  if (room.collaboratorId != null) {
    candidateSources.push(room.collaboratorId);
  }

  if (Array.isArray(room.collaborators)) {
    candidateSources.push(...room.collaborators.map((item) => item?.id));
  }

  if (Array.isArray(room.assignedCollaborators)) {
    candidateSources.push(...room.assignedCollaborators.map((item) => (typeof item === 'object' ? item?.id : item)));
  }

  if (room.assignedCollaboratorId != null) {
    candidateSources.push(room.assignedCollaboratorId);
  }

  const normalizedIds = [];

  candidateSources.forEach((value) => {
    if (!value) {
      return;
    }

    const id = typeof value === 'object' ? value?.id : value;
    if (!id) {
      return;
    }

    const stringId = String(id);
    const isValid = collaborators.some((item) => item.id === stringId);

    if (isValid && !normalizedIds.includes(stringId)) {
      normalizedIds.push(stringId);
    }
  });

  const collaboratorIds = normalizedIds.slice(0, 2);
  const collaboratorCount = collaboratorIds.length;
  const safeGuests = Math.min(collaboratorCount, safeCapacity);

  const statusRaw = typeof room.status === 'string' ? room.status.trim().toLowerCase() : '';
  let status = ROOM_STATUSES.includes(statusRaw) ? statusRaw : 'available';

  if (status !== 'maintenance' && status !== 'cleaning') {
    status = safeGuests > 0 ? 'occupied' : 'available';
  }

  const preCheckin = sanitizePreCheckin(room.preCheckin);

  return {
    id: room.id && !room.id.toString().startsWith('temp') ? room.id : generateId('room'),
    name: room.name || 'Habitación',
    capacity: safeCapacity,
    guests: safeGuests,
    status,
    collaboratorIds,
    maintenanceNote: status === 'maintenance' ? maintenanceNoteRaw : '',
    maintenanceZone: status === 'maintenance' ? maintenanceZoneRaw : '',
    maintenanceAreaType: status === 'maintenance' ? maintenanceAreaType : '',
    maintenanceUpdatedAt: status === 'maintenance' ? maintenanceUpdatedAt : null,
    preCheckin: preCheckin
  };
};

const sanitizeApartment = (apartment, context) => {
  const rooms = Array.isArray(apartment.rooms) ? apartment.rooms.map(sanitizeRoom) : [];
  const statusRaw = typeof apartment.status === 'string' ? apartment.status.trim().toLowerCase().replace(/\s+/g, '_') : '';
  const normalizedStatus = statusRaw.replace(/-/g, '_');
  const status = APARTMENT_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'active';
  const noteRaw = typeof apartment.outOfServiceNote === 'string' ? apartment.outOfServiceNote.trim() : '';
  const limitedNote = noteRaw.length > 320 ? noteRaw.slice(0, 320) : noteRaw;
  const outOfServiceNote = status === 'out_of_service' ? limitedNote : '';

  return {
    id: apartment.id && !apartment.id.toString().startsWith('temp') ? apartment.id : generateId('apto'),
    name: apartment.name || `Apartamento ${context.floorNumber}${String.fromCharCode(65 + context.apartmentIndex)}`,
    number: apartment.number ?? context.apartmentIndex + 1,
    status,
    outOfServiceNote,
    rooms
  };
};

const sanitizeFloor = (floor, context) => {
  const apartments = Array.isArray(floor.apartments)
    ? floor.apartments.map((apartment, apartmentIdx) =>
        sanitizeApartment(apartment, { floorNumber: context.floorIndex + 1, apartmentIndex: apartmentIdx })
      )
    : [];

  return {
    id: floor.id && !floor.id.toString().startsWith('temp') ? floor.id : generateId('floor'),
    name: floor.name || `Piso ${context.floorIndex + 1}`,
    number: floor.number ?? context.floorIndex + 1,
    apartments
  };
};

const sanitizePalacePayload = (payload, fallback) => {
  const seriesNumber = ensurePositiveInt(payload.seriesNumber, fallback?.seriesNumber ?? 1);
  const floors = Array.isArray(payload.floors)
    ? payload.floors.map((floor, idx) => sanitizeFloor(floor, { floorIndex: idx }))
    : [];

  return {
    id: payload.id && !payload.id.toString().startsWith('temp') ? payload.id : fallback?.id || generateId('palace'),
  name: payload.name || fallback?.name || `Edificio ${seriesNumber.toString().padStart(2, '0')}`,
    seriesNumber,
    createdAt: fallback?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    floors
  };
};

const calculatePropertyStats = () => {
  let totalFloors = 0;
  let totalApartments = 0;
  let apartmentsOutOfService = 0;
  let totalRooms = 0;
  let totalCapacity = 0;
  let totalGuests = 0;
  let roomsOccupied = 0;
  let roomsMaintenance = 0;
  let roomsCleaning = 0;

  const occupancyByPalace = palaces.map((palace) => {
    let palaceRooms = 0;
    let palaceCapacity = 0;
    let palaceGuests = 0;
    let palaceOccupied = 0;
    let palaceMaintenance = 0;
    let palaceCleaning = 0;
    let palaceApartmentsOutOfService = 0;

    palace.floors.forEach((floor) => {
      totalFloors += 1;
      floor.apartments.forEach((apartment) => {
        totalApartments += 1;
        const isApartmentOut = apartment.status === 'out_of_service';
        if (isApartmentOut) {
          apartmentsOutOfService += 1;
          palaceApartmentsOutOfService += 1;
        }
        apartment.rooms.forEach((room) => {
          totalRooms += 1;
          palaceRooms += 1;

          const safeCapacity = ensurePositiveInt(room.capacity, 2);
          const collaboratorIds = Array.isArray(room.collaboratorIds)
            ? Array.from(new Set(room.collaboratorIds.filter(Boolean))).slice(0, 2)
            : [];
          const collaboratorCount = collaboratorIds.length;
          const guestValue = ensurePositiveInt(room.guests ?? 0, 0);
          const normalizedGuests = collaboratorCount > 0
            ? Math.min(Math.max(guestValue, collaboratorCount), safeCapacity)
            : 0;
          const statusRaw = typeof room.status === 'string' ? room.status.trim().toLowerCase() : '';

          totalCapacity += safeCapacity;
          palaceCapacity += safeCapacity;
          totalGuests += normalizedGuests;
          palaceGuests += normalizedGuests;

          let effectiveStatus = ROOM_STATUSES.includes(statusRaw) ? statusRaw : 'available';
          if (isApartmentOut) {
            effectiveStatus = 'maintenance';
          } else if (effectiveStatus !== 'maintenance' && effectiveStatus !== 'cleaning') {
            effectiveStatus = normalizedGuests > 0 ? 'occupied' : 'available';
          }

          if (effectiveStatus === 'maintenance') {
            roomsMaintenance += 1;
            palaceMaintenance += 1;
          } else if (effectiveStatus === 'cleaning') {
            roomsCleaning += 1;
            palaceCleaning += 1;
          }

          if (!isApartmentOut && (normalizedGuests > 0 || effectiveStatus === 'occupied')) {
            roomsOccupied += 1;
            palaceOccupied += 1;
          }
        });
      });
    });

    const palaceAvailable = palaceRooms - palaceOccupied - palaceMaintenance - palaceCleaning;
    const occupancyPercent = palaceCapacity > 0 ? Math.round((palaceGuests / palaceCapacity) * 100) : 0;

    return {
      id: palace.id,
      name: palace.name,
      seriesNumber: palace.seriesNumber,
      roomsTotal: palaceRooms,
      roomsOccupied: palaceOccupied,
      roomsMaintenance: palaceMaintenance,
      roomsCleaning: palaceCleaning,
      roomsAvailable: Math.max(palaceAvailable, 0),
      capacity: palaceCapacity,
      guests: palaceGuests,
      occupancyPercent,
      apartmentsOutOfService: palaceApartmentsOutOfService
    };
  });

  const roomsAvailable = totalRooms - roomsOccupied - roomsMaintenance - roomsCleaning;
  const occupancyRate = totalCapacity > 0 ? Math.round((totalGuests / totalCapacity) * 100) : 0;

  return {
    totalPalaces: palaces.length,
    totalFloors,
    totalApartments,
    apartmentsOutOfService,
    totalRooms,
    totalCapacity,
    totalGuests,
    roomsOccupied,
    roomsMaintenance,
    roomsCleaning,
    roomsAvailable: Math.max(roomsAvailable, 0),
    occupancyRate,
    occupancyByPalace
  };
};

let palaces = [];

const seedInitialPalaces = () => {
  palaces = [
    createPalace({ seriesNumber: 1, namePrefix: 'Edificio' }),
    createPalace({ seriesNumber: 2, namePrefix: 'Edificio' })
  ];
};
const shouldSeedDemoPalaces = String(
  process.env.SEED_DEMO_PALACES ??
  process.env.SEED_PALACES ??
  process.env.SEED_ALOJAMIENTOS ??
  ''
)
  .trim()
  .toLowerCase() === 'true';

if (shouldSeedDemoPalaces) {
  seedInitialPalaces();
  console.log('🏨 Datos demo de alojamientos cargados (SEED_DEMO_PALACES=true).');
} else {
  palaces = [];
  console.log('ℹ️ Servidor demo iniciado sin alojamientos precargados.');
}

// =========================================
// Datos de colaboradores
// =========================================
const normalizeDateInput = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const createCollaboratorRecord = ({
  codigo,
  cedula,
  nombre,
  apellido,
  departamento,
  posicion,
  fechaEntrada,
  fechaSalida
}) => {
  const entryDate = normalizeDateInput(fechaEntrada) || new Date().toISOString();
  const exitDate = normalizeDateInput(fechaSalida);

  return {
    id: generateId('colab'),
    codigo,
    cedula,
    nombre,
    apellido,
    departamento,
    posicion,
    fechaEntrada: entryDate,
    fechaSalida: exitDate,
    activo: !exitDate,
    motivoRetiro: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

let collaborators = [];
let collaboratorMovements = [];

const shouldSeedDemoCollaborators = String(
  process.env.SEED_DEMO_COLLABORATORS ??
  process.env.SEED_COLABORADORES ??
  process.env.SEED_COLLABORADORES ??
  ''
)
  .trim()
  .toLowerCase() === 'true';

const clearCollaboratorMovements = () => {
  collaboratorMovements = [];
};

const isSameDay = (dateA, dateB) => {
  if (!dateA || !dateB) {
    return false;
  }

  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
};

const addCollaboratorMovement = ({ type, collaborator, room = null, note = '', reason = '', timestamp = null }) => {
  if (!collaborator) {
    return null;
  }

  const movement = {
    id: generateId('mov'),
    type: type || 'assignment',
    timestamp: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).toISOString() : new Date().toISOString(),
    collaboratorId: collaborator.id,
    collaboratorCodigo: collaborator.codigo,
    collaboratorNombre: `${collaborator.nombre || ''} ${collaborator.apellido || ''}`.trim(),
    department: collaborator.departamento || '',
    position: collaborator.posicion || '',
    palaceId: room?.palaceId || null,
    palaceName: room?.palaceName || '',
    floorName: room?.floorName || '',
    apartmentName: room?.apartmentName || '',
    roomId: room?.roomId || null,
    roomName: room?.roomName || '',
    note: note || '',
    reason: reason || ''
  };

  collaboratorMovements.push(movement);
  collaboratorMovements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return movement;
};

const getTodayCollaboratorMovementsSummary = () => {
  const today = new Date();

  return collaboratorMovements.reduce(
    (acc, movement) => {
      const timestamp = new Date(movement.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        return acc;
      }

      if (!isSameDay(timestamp, today)) {
        return acc;
      }

      const type = (movement.type || '').toLowerCase();

      switch (type) {
        case 'registration':
          acc.registrations += 1;
          break;
        case 'retire':
          acc.retires += 1;
          break;
        case 'assignment':
          acc.assignments += 1;
          break;
        case 'unassignment':
          acc.unassignments += 1;
          break;
        default:
          break;
      }

      return acc;
    },
    {
      registrations: 0,
      retires: 0,
      assignments: 0,
      unassignments: 0
    }
  );
};

const seedCollaboratorMovements = () => {
  collaboratorMovements = [];
  const firstCollaborator = collaborators[0];
  const secondCollaborator = collaborators[1];
  const retiredCollaborator = collaborators.find((item) => !item.activo);

  const firstPalace = palaces[0];
  if (!firstPalace) {
    return;
  }

  const firstRoom = firstPalace.floors?.[0]?.apartments?.[0]?.rooms?.[0];
  const secondRoom = firstPalace.floors?.[0]?.apartments?.[1]?.rooms?.[0];

  if (firstCollaborator && firstRoom) {
    addCollaboratorMovement({
      type: 'assignment',
      collaborator: firstCollaborator,
      room: {
        palaceId: firstPalace.id,
        palaceName: firstPalace.name,
        floorName: firstPalace.floors[0].name,
        apartmentName: firstPalace.floors[0].apartments[0].name,
        roomId: firstRoom.id,
        roomName: firstRoom.name
      },
      note: 'Asignación inicial al edificio'
    });
  }

  if (secondCollaborator && secondRoom) {
    addCollaboratorMovement({
      type: 'assignment',
      collaborator: secondCollaborator,
      room: {
        palaceId: firstPalace.id,
        palaceName: firstPalace.name,
        floorName: firstPalace.floors[0].name,
        apartmentName: firstPalace.floors[0].apartments[1].name,
        roomId: secondRoom.id,
        roomName: secondRoom.name
      },
      note: 'Cobertura de mantenimiento programada'
    });
  }

  if (retiredCollaborator) {
    addCollaboratorMovement({
      type: 'retire',
      collaborator: retiredCollaborator,
      note: 'Retiro programado del colaborador',
      timestamp: retiredCollaborator.fechaSalida
    });
  }
};

const getRecentCollaboratorMovements = (limit = 5) => {
  return collaboratorMovements.slice(0, Math.max(0, limit));
};

const seedCollaborators = () => {
  if (!shouldSeedDemoCollaborators) {
    collaborators = [];
    return;
  }

  const sample = [
    {
      codigo: 'COL-001',
      cedula: 'V-12345678',
      nombre: 'Ana María',
      apellido: 'González',
      departamento: 'Recepción',
      posicion: 'Supervisora',
      fechaEntrada: '2023-08-15'
    },
    {
      codigo: 'COL-002',
      cedula: 'V-21987654',
      nombre: 'Diego',
      apellido: 'Fernández',
      departamento: 'Mantenimiento',
      posicion: 'Técnico HVAC',
      fechaEntrada: '2022-11-03'
    },
    {
      codigo: 'COL-003',
      cedula: 'E-87345012',
      nombre: 'Laura',
      apellido: 'Serrano',
      departamento: 'Housekeeping',
      posicion: 'Coordinadora',
      fechaEntrada: '2024-02-10'
    },
    {
      codigo: 'COL-004',
      cedula: 'V-65432109',
      nombre: 'Carlos',
      apellido: 'Martínez',
      departamento: 'Seguridad',
      posicion: 'Supervisor de turno',
      fechaEntrada: '2021-05-22'
    },
    {
      codigo: 'COL-005',
      cedula: 'V-44556677',
      nombre: 'Verónica',
      apellido: 'Suárez',
      departamento: 'Alimentos y bebidas',
      posicion: 'Chef ejecutiva',
      fechaEntrada: '2020-09-01'
    },
    {
      codigo: 'COL-006',
      cedula: 'E-99887766',
      nombre: 'Gabriel',
      apellido: 'Ortiz',
      departamento: 'Recepción',
      posicion: 'Recepcionista',
      fechaEntrada: '2024-06-18'
    },
    {
      codigo: 'COL-007',
      cedula: 'V-33221100',
      nombre: 'Marta',
      apellido: 'Villalba',
      departamento: 'Housekeeping',
      posicion: 'Especialista en habitaciones',
      fechaEntrada: '2019-03-12',
      fechaSalida: '2024-12-20'
    }
  ];

  collaborators = sample.map(createCollaboratorRecord);
};

const getCollaboratorSummary = () => {
  const total = collaborators.length;
  const activos = collaborators.filter((item) => item.activo).length;
  const retirados = total - activos;

  return {
    total,
    activos,
    retirados
  };
};

const getCollaboratorsByEstado = (estado) => {
  if (estado === 'activos') {
    return collaborators.filter((item) => item.activo);
  }

  if (estado === 'retirados') {
    return collaborators.filter((item) => !item.activo);
  }

  return collaborators;
};

const mapCollaboratorForRoom = (collaborator) => {
  if (!collaborator) {
    return null;
  }

  return {
    id: collaborator.id,
    codigo: collaborator.codigo,
    cedula: collaborator.cedula,
    nombre: collaborator.nombre,
    apellido: collaborator.apellido,
    departamento: collaborator.departamento,
    posicion: collaborator.posicion,
    activo: collaborator.activo,
    fechaEntrada: collaborator.fechaEntrada,
    fechaSalida: collaborator.fechaSalida
  };
};

const decorateRoomWithCollaborator = (room) => {
  const capacity = ensurePositiveInt(room.capacity, 2);
  const collaboratorIds = Array.isArray(room.collaboratorIds)
    ? Array.from(new Set(room.collaboratorIds.filter(Boolean))).slice(0, 2)
    : [];
  const collaboratorDetails = collaboratorIds
    .map((id) => collaborators.find((item) => item.id === id))
    .filter(Boolean)
    .map(mapCollaboratorForRoom);
  const collaboratorCount = collaboratorDetails.length;
  const guestValue = ensurePositiveInt(room.guests ?? 0, 0);
  const normalizedGuests = collaboratorCount > 0
    ? Math.min(Math.max(guestValue, collaboratorCount), capacity)
    : 0;
  const statusRaw = typeof room.status === 'string' ? room.status.trim().toLowerCase() : '';
  const baseStatus = ROOM_STATUSES.includes(statusRaw) ? statusRaw : 'available';
  const resolvedStatus = baseStatus === 'maintenance' || baseStatus === 'cleaning'
    ? baseStatus
    : normalizedGuests > 0
      ? 'occupied'
      : 'available';

  return {
    ...room,
    capacity,
    guests: normalizedGuests,
    status: resolvedStatus,
    collaboratorIds,
    collaborators: collaboratorDetails,
    maintenanceNote: room.maintenanceNote || '',
    maintenanceZone: room.maintenanceZone || '',
    maintenanceAreaType: room.maintenanceAreaType || '',
    maintenanceUpdatedAt: room.maintenanceUpdatedAt || null,
    preCheckin: room.preCheckin ? sanitizePreCheckin(room.preCheckin) : null
  };
};

const decoratePalaceWithCollaborators = (palace) => ({
  ...palace,
  floors: palace.floors.map((floor) => ({
    ...floor,
    apartments: floor.apartments.map((apartment) => ({
      ...apartment,
      rooms: apartment.rooms.map(decorateRoomWithCollaborator)
    }))
  }))
});

const collectPalaceRoomEntries = (palace) => {
  if (!palace || !Array.isArray(palace.floors)) {
    return [];
  }

  const entries = [];

  palace.floors.forEach((floor) => {
    if (!floor || !Array.isArray(floor.apartments)) {
      return;
    }

    floor.apartments.forEach((apartment) => {
      if (!apartment || !Array.isArray(apartment.rooms)) {
        return;
      }

      apartment.rooms.forEach((room) => {
        if (!room) {
          return;
        }

        const collaboratorIds = Array.isArray(room.collaboratorIds)
          ? Array.from(new Set(room.collaboratorIds.filter(Boolean))).slice(0, 2)
          : [];
        const collaboratorCount = collaboratorIds.length;
        const safeCapacity = ensurePositiveInt(room.capacity, 2);
        const guestValue = ensurePositiveInt(room.guests ?? 0, 0);
        const normalizedGuests = collaboratorCount > 0
          ? Math.min(Math.max(guestValue, collaboratorCount), safeCapacity)
          : 0;
        const statusRaw = typeof room.status === 'string' ? room.status.trim().toLowerCase() : '';
        let normalizedStatus = ROOM_STATUSES.includes(statusRaw) ? statusRaw : 'available';

        if (normalizedStatus !== 'maintenance' && normalizedStatus !== 'cleaning') {
          normalizedStatus = normalizedGuests > 0 ? 'occupied' : 'available';
        }

        entries.push({
          roomId: room.id,
          collaboratorIds,
          context: {
            palaceId: palace.id,
            palaceName: palace.name,
            floorId: floor.id,
            floorName: floor.name || '',
            apartmentId: apartment.id,
            apartmentName: apartment.name || '',
            roomId: room.id,
            roomName: room.name || '',
            roomStatus: normalizedStatus
          }
        });
      });
    });
  });

  return entries;
};

const buildRoomAssignmentsIndex = (entries = []) => {
  const assignmentIndex = new Map();

  entries.forEach((entry) => {
    if (!entry || !Array.isArray(entry.collaboratorIds)) {
      return;
    }

    entry.collaboratorIds.forEach((collaboratorId) => {
      if (!collaboratorId || assignmentIndex.has(collaboratorId)) {
        return;
      }

      assignmentIndex.set(collaboratorId, {
        roomId: entry.roomId || null,
        context: entry.context || {}
      });
    });
  });

  return assignmentIndex;
};

const buildAssignmentMovementNote = (targetRoom, previousRoom) => {
  if (previousRoom && previousRoom.roomId && previousRoom.roomId !== targetRoom.roomId) {
    const sourceLabel = [previousRoom.roomName, previousRoom.palaceName].filter(Boolean).join(' - ');
    return sourceLabel ? `Reasignado desde ${sourceLabel}` : 'Reasignación registrada';
  }

  const targetLabel = [targetRoom.roomName, targetRoom.palaceName].filter(Boolean).join(' - ');
  return targetLabel ? `Asignado a ${targetLabel}` : 'Asignación registrada';
};

const buildUnassignmentMovementNote = (room) => {
  if (!room) {
    return 'Desasignación registrada';
  }

  const roomLabel = [room.roomName, room.palaceName].filter(Boolean).join(' - ');
  if (roomLabel) {
    return `Desasignado de ${roomLabel}`;
  }

  return room.palaceName ? `Desasignado de ${room.palaceName}` : 'Desasignación registrada';
};

const buildCollaboratorAssignmentsIndex = () => {
  const assignmentMap = new Map();

  palaces.forEach((palace) => {
    palace.floors.forEach((floor) => {
      floor.apartments.forEach((apartment) => {
        apartment.rooms.forEach((room) => {
          const collaboratorIds = Array.isArray(room.collaboratorIds) ? room.collaboratorIds : [];

          collaboratorIds.forEach((collaboratorId) => {
            if (!assignmentMap.has(collaboratorId)) {
              assignmentMap.set(collaboratorId, []);
            }

            assignmentMap.get(collaboratorId).push({
              palaceId: palace.id,
              palaceName: palace.name,
              palaceSeriesNumber: palace.seriesNumber,
              floorId: floor.id,
              floorName: floor.name,
              apartmentId: apartment.id,
              apartmentName: apartment.name,
              apartmentStatus: apartment.status || 'active',
              apartmentOutOfServiceNote: apartment.status === 'out_of_service' ? apartment.outOfServiceNote || '' : '',
              roomId: room.id,
              roomName: room.name,
              status: room.status,
              capacity: room.capacity,
              guests: room.guests,
              maintenanceNote: room.maintenanceNote || '',
              maintenanceZone: room.maintenanceZone || '',
              maintenanceAreaType: room.maintenanceAreaType || '',
              maintenanceUpdatedAt: room.maintenanceUpdatedAt || null
            });
          });
        });
      });
    });
  });

  assignmentMap.forEach((rooms) => {
    rooms.sort((a, b) => {
      if (a.palaceName !== b.palaceName) {
        return a.palaceName.localeCompare(b.palaceName);
      }
      return a.roomName.localeCompare(b.roomName);
    });
  });

  return assignmentMap;
};

const mapCollaboratorWithAssignments = (collaborator, assignmentIndex) => {
  const assignedRooms = assignmentIndex.get(collaborator.id) || [];
  return {
    ...collaborator,
    assignedRooms
  };
};

const buildOccupancyBreakdown = (assignmentIndex, selector, labelKey) => {
  const breakdownMap = new Map();

  collaborators
    .filter((collaborator) => collaborator.activo)
    .forEach((collaborator) => {
      const rawKey = selector(collaborator);
      const key = rawKey && rawKey.trim() ? rawKey.trim() : 'Sin definir';
      const assignments = assignmentIndex.get(collaborator.id) || [];

      if (!breakdownMap.has(key)) {
        breakdownMap.set(key, {
          [labelKey]: key,
          activeCollaborators: 0,
          roomsAssigned: 0,
          _uniqueRooms: new Set()
        });
      }

      const entry = breakdownMap.get(key);
      entry.activeCollaborators += 1;

      assignments.forEach((assignment) => {
        if (assignment?.roomId) {
          entry._uniqueRooms.add(assignment.roomId);
        }
      });
    });

  const result = Array.from(breakdownMap.values()).map((entry) => ({
    [labelKey]: entry[labelKey],
    activeCollaborators: entry.activeCollaborators,
    roomsAssigned: entry._uniqueRooms.size
  }));

  result.sort((a, b) => {
    if (b.roomsAssigned !== a.roomsAssigned) {
      return b.roomsAssigned - a.roomsAssigned;
    }
    return b.activeCollaborators - a.activeCollaborators;
  });

  return result;
};

const buildMaintenanceAlerts = () => {
  const alerts = [];

  palaces.forEach((palace) => {
    palace.floors.forEach((floor) => {
      floor.apartments.forEach((apartment) => {
        if (apartment.status === 'out_of_service') {
          const note = typeof apartment.outOfServiceNote === 'string' ? apartment.outOfServiceNote : '';
          const timestampSource = palace.updatedAt ? new Date(palace.updatedAt) : new Date();
          const timestamp = Number.isNaN(timestampSource.getTime()) ? new Date().toISOString() : timestampSource.toISOString();

          alerts.push({
            id: `${palace.id}-${floor.id}-${apartment.id}-out-of-service`,
            tipo: 'error',
            mensaje: `Apartamento ${apartment.name} fuera de servicio`,
            nota: note,
            timestamp,
            palaceId: palace.id,
            palaceName: palace.name,
            floorId: floor.id,
            floorName: floor.name,
            apartmentId: apartment.id,
            apartmentName: apartment.name,
            apartmentStatus: apartment.status,
            status: 'out_of_service',
            roomId: null,
            roomName: null
          });
        }
        apartment.rooms.forEach((room) => {
          if (room.status === 'maintenance') {
            const note = typeof room.maintenanceNote === 'string' ? room.maintenanceNote.trim() : '';
            const maintenanceZone = typeof room.maintenanceZone === 'string' ? room.maintenanceZone.trim() : '';
            const maintenanceAreaTypeRaw = typeof room.maintenanceAreaType === 'string' ? room.maintenanceAreaType.trim().toLowerCase() : '';
            const maintenanceAreaType = MAINTENANCE_AREA_TYPES.includes(maintenanceAreaTypeRaw) ? maintenanceAreaTypeRaw : '';
            const areaLabel = MAINTENANCE_AREA_LABELS[maintenanceAreaType] || '';
            const timestampSource = room.maintenanceUpdatedAt
              ? new Date(room.maintenanceUpdatedAt)
              : new Date(palace.updatedAt || Date.now());
            const timestamp = Number.isNaN(timestampSource.getTime())
              ? new Date().toISOString()
              : timestampSource.toISOString();
            const baseMessageParts = [`Habitación ${room.name} en mantenimiento`];
            if (areaLabel) {
              baseMessageParts.push(`(${areaLabel})`);
            }
            if (maintenanceZone) {
              baseMessageParts.push(`• Zona: ${maintenanceZone}`);
            }
            const baseMessage = baseMessageParts.join(' ');

            alerts.push({
              id: `${palace.id}-${floor.id}-${apartment.id}-${room.id}`,
              tipo: 'warning',
              mensaje: baseMessage,
              nota: note,
              timestamp,
              palaceId: palace.id,
              palaceName: palace.name,
              floorId: floor.id,
              floorName: floor.name,
              apartmentId: apartment.id,
              apartmentName: apartment.name,
              roomId: room.id,
              roomName: room.name,
              status: room.status,
              maintenanceZone,
              maintenanceAreaType
            });
          }
        });
      });
    });
  });

  alerts.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateB - dateA;
  });

  return alerts;
};

const findRoomInDecoratedPalace = (palace, roomId) => {
  for (const floor of palace.floors) {
    for (const apartment of floor.apartments) {
      const room = apartment.rooms.find((item) => item.id === roomId);
      if (room) {
        return room;
      }
    }
  }
  return null;
};

seedCollaborators();

const shouldSeedCollaboratorMovements = String(process.env.SEED_COLLABORATOR_MOVEMENTS || '')
  .trim()
  .toLowerCase() === 'true';

if (shouldSeedCollaboratorMovements) {
  seedCollaboratorMovements();
} else {
  collaboratorMovements = [];
}

if (!tenantDatasets.has(DEFAULT_NAMESPACE_KEY)) {
  tenantDatasets.set(DEFAULT_NAMESPACE_KEY, {
    palaces,
    collaborators,
    collaboratorMovements
  });
} else {
  const defaultDataset = tenantDatasets.get(DEFAULT_NAMESPACE_KEY);
  defaultDataset.palaces = palaces;
  defaultDataset.collaborators = collaborators;
  defaultDataset.collaboratorMovements = collaboratorMovements;
}

if (!tenantDatasets.has(COSTADORADA_NAMESPACE_KEY)) {
  tenantDatasets.set(COSTADORADA_NAMESPACE_KEY, {
    palaces: deepClone(palaces),
    collaborators: deepClone(collaborators),
    collaboratorMovements: deepClone(collaboratorMovements)
  });
}

// --- RUTAS DE AUTENTICACIÓN ---
// Ruta con prefijo /api
app.post('/api/auth/login', (req, res) => {
  console.log('📝 Datos recibidos (API):', req.body);
  
  const { email, username, password } = req.body;
  const userEmail = email || username; // Acepta tanto email como username
  
  if (!userEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/Usuario y contraseña son requeridos'
    });
  }
  
  const matchedUser = findDemoUser(userEmail);

  if (matchedUser && password === matchedUser.password) {
    const token = jwt.sign(
      { 
        id: matchedUser.id, 
        email: matchedUser.email, 
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Login exitoso (API) para:', matchedUser.email);
    res.json({
      success: true,
      token: token,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        nombre: matchedUser.nombre,
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      }
    });
  } else {
    console.log('❌ Credenciales incorrectas (API):', { userEmail, password });
    res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }
});

// Ruta sin prefijo /api para compatibilidad
app.post('/auth/login', (req, res) => {
  console.log('📝 Datos recibidos (SIMPLE):', req.body);
  
  const { email, username, password } = req.body;
  const userEmail = email || username; // Acepta tanto email como username
  
  if (!userEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/Usuario y contraseña son requeridos'
    });
  }
  
  const matchedUser = findDemoUser(userEmail);

  if (matchedUser && password === matchedUser.password) {
    const token = jwt.sign(
      { 
        id: matchedUser.id, 
        email: matchedUser.email, 
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Login exitoso (SIMPLE) para:', matchedUser.email);
    res.json({
      success: true,
      token: token,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        nombre: matchedUser.nombre,
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      }
    });
  } else {
    console.log('❌ Credenciales incorrectas (SIMPLE):', { userEmail, password });
    res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  console.log('🔍 Verificando token:', authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const matchedUser = demoUsers.find((user) => user.id === decoded.id) || findDemoUser(decoded.email);

    if (!matchedUser) {
      console.log('❌ Usuario no encontrado para token decodificado:', decoded);
      return res.status(401).json({ message: 'Token inválido' });
    }

    console.log('✅ Token válido para:', matchedUser.email);
    res.json({
      id: matchedUser.id,
      email: matchedUser.email,
      nombre: matchedUser.nombre,
      rol: matchedUser.rol,
      namespace: matchedUser.namespace
    });
  } catch (error) {
    console.log('❌ Token inválido:', error.message);
    res.status(401).json({ message: 'Token inválido' });
  }
});

app.post('/api/admin/tenants', (req, res) => {
  const payload = req.body || {};
  const { namespace, hotelName, contactEmail, password, contactName } = payload;

  console.log('🆕 Registro de tenant solicitado:', payload);

  const result = registerTenantDemoUser({ namespace, hotelName, contactEmail, password, contactName });

  if (result.error === 'missing_fields') {
    return res.status(400).json({ success: false, message: 'namespace, correo y contraseña son requeridos.' });
  }

  if (result.error === 'duplicate') {
    return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo o namespace.' });
  }

  const user = result.user;
  console.log('✅ Tenant registrado en demoUsers:', user);

  return res.json({ success: true, user });
});

app.delete('/api/admin/tenants/:namespace', (req, res) => {
  const { namespace } = req.params || {};
  console.log('🗑️ Eliminación de tenant solicitada:', namespace);

  const result = removeTenantDemoUser(namespace);

  if (result.error === 'missing_namespace') {
    return res.status(400).json({ success: false, message: 'Debes proporcionar un namespace válido.' });
  }

  if (result.error === 'protected') {
    return res.status(403).json({ success: false, message: 'No puedes eliminar el PMS principal.' });
  }

  if (result.error === 'not_found') {
    return res.status(404).json({ success: false, message: 'No se encontró un tenant con ese namespace.' });
  }

  console.log('✅ Tenant eliminado de demoUsers:', result.user?.namespace);
  return res.json({ success: true });
});

// --- RUTAS DE COLABORADORES ---
app.get('/api/colaboradores', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const { estado } = req.query || {};
    const list = getCollaboratorsByEstado(typeof estado === 'string' ? estado.toLowerCase() : undefined);
    const summary = getCollaboratorSummary();
    const assignmentsIndex = buildCollaboratorAssignmentsIndex();
    const listWithAssignments = list.map((item) => mapCollaboratorWithAssignments(item, assignmentsIndex));

    res.json({
      success: true,
      colaboradores: listWithAssignments,
      meta: {
        total: summary.total,
        activos: summary.activos,
        retirados: summary.retirados,
        visibles: list.length
      }
    });
  })
);

app.post('/api/colaboradores', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const payload = req.body || {};
    const requiredFields = ['codigo', 'cedula', 'nombre', 'apellido', 'departamento', 'posicion', 'fechaEntrada'];
    const missing = requiredFields.filter((field) => !payload[field] || !String(payload[field]).trim());

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Campos requeridos faltantes: ${missing.join(', ')}`
      });
    }

    if (payload.fechaSalida && payload.fechaEntrada && new Date(payload.fechaSalida) < new Date(payload.fechaEntrada)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de salida no puede ser anterior a la fecha de ingreso'
      });
    }

    const normalizedCodigo = String(payload.codigo).trim();
    if (collaborators.some((item) => item.codigo.toLowerCase() === normalizedCodigo.toLowerCase())) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un colaborador con ese código'
      });
    }

    const record = createCollaboratorRecord({
      codigo: normalizedCodigo,
      cedula: String(payload.cedula).trim(),
      nombre: String(payload.nombre).trim(),
      apellido: String(payload.apellido).trim(),
      departamento: String(payload.departamento).trim(),
      posicion: String(payload.posicion).trim(),
      fechaEntrada: payload.fechaEntrada,
      fechaSalida: payload.fechaSalida || null
    });

    collaborators.unshift(record);

    addCollaboratorMovement({
      type: 'registration',
      collaborator: record,
      note: 'Nuevo colaborador registrado'
    });

    const summary = getCollaboratorSummary();
    const assignmentsIndex = buildCollaboratorAssignmentsIndex();
    const decorated = mapCollaboratorWithAssignments(record, assignmentsIndex);

    res.status(201).json({
      success: true,
      colaborador: decorated,
      meta: {
        total: summary.total,
        activos: summary.activos,
        retirados: summary.retirados
      }
    });
  })
);

app.post('/api/colaboradores/:colaboradorId/retire', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const { colaboradorId } = req.params;
    const collaborator = collaborators.find((item) => item.id === colaboradorId);

    if (!collaborator) {
      return res.status(404).json({ success: false, message: 'Colaborador no encontrado' });
    }

    if (!collaborator.activo) {
      return res.status(400).json({ success: false, message: 'El colaborador ya fue retirado' });
    }

    const exitDateRaw = req.body?.fechaSalida;
    const normalizedExit = exitDateRaw ? normalizeDateInput(exitDateRaw) : null;
    const rawReason = typeof req.body?.motivoRetiro === 'string' ? req.body.motivoRetiro : '';
    const normalizedReason = rawReason.trim();

    if (exitDateRaw && !normalizedExit) {
      return res.status(400).json({ success: false, message: 'Fecha de salida inválida' });
    }

    const exitDate = normalizedExit || new Date().toISOString();

    if (new Date(exitDate) < new Date(collaborator.fechaEntrada)) {
      return res.status(400).json({ success: false, message: 'La fecha de salida no puede ser anterior a la fecha de entrada' });
    }

    collaborator.fechaSalida = exitDate;
    collaborator.activo = false;
    collaborator.motivoRetiro = normalizedReason;
    collaborator.updatedAt = new Date().toISOString();

    const summary = getCollaboratorSummary();
    const assignmentsIndex = buildCollaboratorAssignmentsIndex();
    const decoratedCollaborator = mapCollaboratorWithAssignments(collaborator, assignmentsIndex);

    const firstAssignment = assignmentsIndex.get(collaborator.id)?.[0] || null;
    addCollaboratorMovement({
      type: 'retire',
      collaborator,
      room: firstAssignment,
      note: `Retiro${normalizedReason ? ` (${normalizedReason})` : ''} registrado para ${new Date(exitDate).toLocaleDateString('es-ES')}`,
      reason: normalizedReason
    });

    res.json({
      success: true,
      colaborador: decoratedCollaborator,
      meta: {
        total: summary.total,
        activos: summary.activos,
        retirados: summary.retirados
      }
    });
  })
);

const parseDateRangeValue = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

app.get('/api/colaboradores/movimientos', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const { from, to, limit } = req.query || {};
    const fromDate = parseDateRangeValue(from);
    const toDate = parseDateRangeValue(to);
    const normalizedTo = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null; // include end day
    const requestedLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : null;

    const filtered = collaboratorMovements.filter((movement) => {
      const movementDate = new Date(movement.timestamp);
      if (Number.isNaN(movementDate.getTime())) {
        return false;
      }
      if (fromDate && movementDate < fromDate) {
        return false;
      }
      if (normalizedTo && movementDate >= normalizedTo) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const trimmed = requestedLimit ? filtered.slice(0, requestedLimit) : filtered;

    res.json({
      success: true,
      movimientos: trimmed,
      total: filtered.length
    });
  })
);

app.delete('/api/colaboradores/movimientos', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const removedCount = collaboratorMovements.length;
    clearCollaboratorMovements();
    res.json({
      success: true,
      movimientos: [],
      total: 0,
      removed: removedCount
    });
  })
);

// --- RUTAS DE ALOJAMIENTOS (EDIFICIOS) ---
app.get('/api/alojamientos/palaces', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const stats = calculatePropertyStats();
    const decoratedPalaces = palaces.map(decoratePalaceWithCollaborators);
    res.json({
      success: true,
      palaces: decoratedPalaces,
      summary: {
        totalPalaces: stats.totalPalaces,
        totalFloors: stats.totalFloors,
        totalApartments: stats.totalApartments,
        totalRooms: stats.totalRooms,
        totalCapacity: stats.totalCapacity,
        totalGuests: stats.totalGuests,
        occupancyRate: stats.occupancyRate
      }
    });
  })
);

app.post('/api/alojamientos/palaces', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const {
      seriesNumber,
      floors = 3,
      apartmentsPerFloor = 4,
      roomsPerApartment = 2,
      capacityPerRoom = 2,
      namePrefix = 'Edificio',
      customName = ''
    } = req.body || {};

    const newPalace = createPalace({
      seriesNumber: seriesNumber || palaces.length + 1,
      floors: ensurePositiveInt(floors, 3),
      apartmentsPerFloor: ensurePositiveInt(apartmentsPerFloor, 4),
      roomsPerApartment: ensurePositiveInt(roomsPerApartment, 2),
      capacityPerRoom: ensurePositiveInt(capacityPerRoom, 2),
      namePrefix,
      customName
    });

    palaces.push(newPalace);
    const stats = calculatePropertyStats();
    const decoratedPalace = decoratePalaceWithCollaborators(newPalace);
    res.status(201).json({ success: true, palace: decoratedPalace, summary: stats });
  })
);

app.delete('/api/alojamientos/palaces/:palaceId', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const { palaceId } = req.params;
    const existing = palaces.find((palace) => palace.id === palaceId);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Edificio no encontrado' });
    }

    palaces = palaces.filter((palace) => palace.id !== palaceId);
    const stats = calculatePropertyStats();
    const decoratedPalaces = palaces.map(decoratePalaceWithCollaborators);
    res.json({
      success: true,
      palaces: decoratedPalaces,
      summary: stats
    });
  })
);

app.put('/api/alojamientos/palaces/:palaceId', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const { palaceId } = req.params;
    const index = palaces.findIndex((palace) => palace.id === palaceId);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Edificio no encontrado' });
    }

    const currentPalace = palaces[index];
    const previousEntries = collectPalaceRoomEntries(currentPalace);
    const previousEntriesByRoom = new Map(previousEntries.map((entry) => [entry.roomId, entry]));
    const previousAssignmentsByCollaborator = new Map();
    previousEntries.forEach((entry) => {
      entry.collaboratorIds.forEach((collaboratorId) => {
        if (!previousAssignmentsByCollaborator.has(collaboratorId)) {
          previousAssignmentsByCollaborator.set(collaboratorId, entry.context);
        }
      });
    });

    const sanitizedPayload = sanitizePalacePayload(req.body || {}, currentPalace);
    palaces[index] = sanitizedPayload;

    const nextEntries = collectPalaceRoomEntries(sanitizedPayload);
    const nextAssignments = buildRoomAssignmentsIndex(nextEntries);

    const newAssignments = [];
    const removedAssignments = [];

    nextEntries.forEach((entry) => {
      entry.collaboratorIds.forEach((collaboratorId) => {
        if (!previousAssignmentsByCollaborator.has(collaboratorId)) {
          newAssignments.push({ collaboratorId, room: entry.context });
        }
      });
    });

    previousEntries.forEach((entry) => {
      entry.collaboratorIds.forEach((collaboratorId) => {
        if (!nextAssignments.has(collaboratorId)) {
          removedAssignments.push({ collaboratorId, room: entry.context });
        }
      });
    });

    const assignmentsIndex = buildCollaboratorAssignmentsIndex();
    const stats = calculatePropertyStats();
    const decoratedPalace = decoratePalaceWithCollaborators(palaces[index]);

    newAssignments.forEach((assignment) => {
      const collaborator = collaborators.find((item) => item.id === assignment.collaboratorId);
      if (!collaborator) {
        return;
      }
      addCollaboratorMovement({
        type: 'assignment',
        collaborator,
        room: assignment.room,
        note: buildAssignmentMovementNote(assignment.room, previousAssignmentsByCollaborator.get(collaborator.id) || null)
      });
    });

    removedAssignments.forEach((assignment) => {
      const collaborator = collaborators.find((item) => item.id === assignment.collaboratorId);
      if (!collaborator) {
        return;
      }
      addCollaboratorMovement({
        type: 'unassignment',
        collaborator,
        room: assignment.room,
        note: buildUnassignmentMovementNote(assignment.room)
      });
    });

    res.json({
      success: true,
      palace: decoratedPalace,
      summary: stats,
      assignmentsIndex: Object.fromEntries(assignmentsIndex)
    });
  })
);

app.patch('/api/alojamientos/palaces/:palaceId/rooms/:roomId', (req, res) =>
  respondWithTenantContext(req, res, ({ namespace }) => {
    const { palaceId, roomId } = req.params;
    const payload = req.body || {};

    console.log('🛠️  Actualización de habitación solicitada', {
      namespace,
      palaceId,
      roomId,
      includesPreCheckin: typeof payload.preCheckin === 'object' && payload.preCheckin !== null
    });

    const palace = palaces.find((item) => item.id === palaceId);
    if (!palace) {
      return res.status(404).json({ success: false, message: 'Edificio no encontrado' });
    }

    let targetRoom = null;

    palace.floors.forEach((floor) => {
      floor.apartments.forEach((apartment) => {
        apartment.rooms = apartment.rooms.map((room) => {
          if (room.id === roomId) {
            const sanitized = sanitizeRoom({ ...room, ...payload });
            targetRoom = sanitized;
            return sanitized;
          }
          return room;
        });
      });
    });

    if (!targetRoom) {
      return res.status(404).json({ success: false, message: 'Habitación no encontrada' });
    }

    palace.updatedAt = new Date().toISOString();
    const stats = calculatePropertyStats();
    const decoratedPalace = decoratePalaceWithCollaborators(palace);
    const decoratedRoom = findRoomInDecoratedPalace(decoratedPalace, roomId);

    res.json({ success: true, palace: decoratedPalace, room: decoratedRoom, summary: stats });
  })
);

// --- DATOS BASE DEL DASHBOARD ---
const dashboardBase = {
  ingresosDiarios: 0,
  checkinsPendientes: 12,
  checkinsCompletados: 8,
  retirosHoy: 0,
  personalActivo: 25,
  tareasAbiertas: 7,
  tendenciaOcupacion: '+5.2%',
  tendenciaIngresos: '',
  tendenciaCheckins: '+3',
  tendenciaPersonal: 'Estable',
  fechasIngresos: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  ingresosSemana: [2800, 3200, 2900, 3500, 4100, 3800, 3300],
  ultimosCheckins: [
    { huesped: 'María García López', unidad: 'P01-101', fecha: new Date().toISOString() },
    { huesped: 'Juan Carlos Pérez', unidad: 'P02-205', fecha: new Date().toISOString() },
    { huesped: 'Ana Isabel López', unidad: 'P01-303', fecha: new Date().toISOString() }
  ],
  alertas: []
};

app.get('/api/dashboard/overview', (req, res) =>
  respondWithTenantContext(req, res, () => {
    const stats = calculatePropertyStats();
    const collaboratorSummary = getCollaboratorSummary();
    const assignmentsIndex = buildCollaboratorAssignmentsIndex();
    const movements = getRecentCollaboratorMovements(20);
    const alerts = buildMaintenanceAlerts();

    const occupancyByDepartment = buildOccupancyBreakdown(assignmentsIndex, (collaborator) => collaborator.departamento, 'department');
    const occupancyByPosition = buildOccupancyBreakdown(assignmentsIndex, (collaborator) => collaborator.posicion, 'position');

    const payload = {
      success: true,
      ocupacionPorcentaje: stats.occupancyRate,
      unidadesOcupadas: stats.roomsOccupied,
      unidadesDisponibles: stats.roomsAvailable,
      unidadesMantenimiento: stats.roomsMaintenance,
      unidadesLimpieza: stats.roomsCleaning,
      apartamentosFueraServicio: stats.apartmentsOutOfService,
      totalUnidades: stats.totalRooms,
      huespedesActuales: stats.totalGuests,
      capacidadTotal: stats.totalCapacity,
      huespedesDisponibles: Math.max(stats.totalCapacity - stats.totalGuests, 0),
      ingresosDiarios: dashboardBase.ingresosDiarios,
      checkinsPendientes: dashboardBase.checkinsPendientes,
      checkinsCompletados: dashboardBase.checkinsCompletados,
      retirosHoy: dashboardBase.retirosHoy,
      tendenciaOcupacion: dashboardBase.tendenciaOcupacion,
      tendenciaIngresos: dashboardBase.tendenciaIngresos,
      tendenciaCheckins: dashboardBase.tendenciaCheckins,
      tendenciaPersonal: dashboardBase.tendenciaPersonal,
      fechasIngresos: dashboardBase.fechasIngresos,
      ingresosSemana: dashboardBase.ingresosSemana,
      ultimosCheckins: dashboardBase.ultimosCheckins,
      personalActivo: collaboratorSummary.activos,
      colaboradoresTotales: collaboratorSummary.total,
      colaboradorResumen: collaboratorSummary,
  movimientosColaboradores: movements,
  alertas: alerts.length > 0 ? alerts : dashboardBase.alertas,
      ocupacionPorPalace: stats.occupancyByPalace,
      ocupacionPorDepartamento: occupancyByDepartment,
      ocupacionPorPosicion: occupancyByPosition,
      summary: {
        totalPalaces: stats.totalPalaces,
        totalFloors: stats.totalFloors,
        totalApartments: stats.totalApartments,
        totalRooms: stats.totalRooms,
        totalCapacity: stats.totalCapacity,
        totalGuests: stats.totalGuests,
        occupancyRate: stats.occupancyRate
      }
    };

    res.json(payload);
  })
);

app.listen(PORT, () => {
  console.log('🚀 Demo server escuchando en el puerto', PORT);
});
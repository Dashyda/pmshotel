import {
  loadActiveTenantNamespace,
  subscribeActiveTenantNamespace,
  DEFAULT_TENANT
} from '../utils/branding';

export const MTTO_REPORTS_STORAGE_KEY = 'mtto_reports_data';
export const MTTO_REPORTS_EVENT_NAME = 'mtto-reports-updated';
export const MAX_COLLABORATORS_PER_ROOM = 2;

const buildStorageKey = (namespace) => {
  const resolved = (namespace || '').trim() || DEFAULT_TENANT;
  return `${MTTO_REPORTS_STORAGE_KEY}__${resolved}`;
};

let activeNamespace = loadActiveTenantNamespace();

if (typeof window !== 'undefined') {
  subscribeActiveTenantNamespace?.((namespace) => {
    activeNamespace = namespace || DEFAULT_TENANT;
  });
}

export const getActiveMttoNamespace = () => activeNamespace;

const readReportsFromStorage = (namespace) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const storageKey = buildStorageKey(namespace);
  const stored = window.localStorage.getItem(storageKey);
  return stored;
};

export const MTTO_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja'];

export const MTTO_CATEGORY_OPTIONS = [
  'Eléctrico',
  'Plomería',
  'Climatización',
  'Carpintería',
  'Pintura',
  'Electrodomésticos',
  'General'
];

export const MTTO_AREA_OPTIONS = [
  { value: 'room', label: 'Habitación' },
  { value: 'bathroom', label: 'Baño' },
  { value: 'common', label: 'Zona común' }
];

export const loadStoredMttoReports = (namespace) => {
  try {
    const stored = readReportsFromStorage(namespace ?? activeNamespace);
    if (stored === null) {
      return { reports: [], hasStoredValue: false };
    }
    const parsed = JSON.parse(stored);
    return {
      reports: Array.isArray(parsed) ? parsed : [],
      hasStoredValue: true
    };
  } catch (error) {
    console.warn('No se pudieron cargar los reportes MTTO guardados.', error);
    return { reports: [], hasStoredValue: true };
  }
};

export const saveMttoReports = (reports, namespace) => {
  if (typeof window === 'undefined') {
    return;
  }
  const storageKey = buildStorageKey(namespace ?? activeNamespace);
  window.localStorage.setItem(storageKey, JSON.stringify(Array.isArray(reports) ? reports : []));
};

export const notifyMttoReportsUpdated = (namespace) => {
  if (typeof window === 'undefined') {
    return;
  }
  const detail = {
    namespace: (namespace || activeNamespace || DEFAULT_TENANT)
  };
  window.dispatchEvent(new CustomEvent(MTTO_REPORTS_EVENT_NAME, { detail }));
};

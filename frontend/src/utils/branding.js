const BRANDING_STORAGE_KEY = 'pms_branding_config';
const TENANTS_STORAGE_KEY = 'pms_tenants_registry';
const BRANDING_EVENT = 'branding-updated';
const TENANTS_EVENT = 'tenants-updated';
const ACTIVE_TENANT_STORAGE_KEY = 'pms_active_namespace';
const ACTIVE_TENANT_EVENT = 'tenant-namespace-changed';
const DEFAULT_TENANT_NAMESPACE = 'tenant_default';
const DEFAULT_BRANDING_STORAGE_KEY = 'pms_branding_default_template';

export const DEFAULT_BRANDING = {
  hotelName: 'PMS Hotel',
  tagline: 'Costa Dorada Premium',
  loginBackgroundUrl: '/assets/branding/login-hero.jpg'
};

const DEFAULT_TENANTS_REGISTRY = [
  {
    id: 'tenant_costadorada',
    namespace: 'tenant_costadorada',
    hotelName: 'Costa Dorada Premium',
    tagline: 'Cancún, México',
    contactName: 'Gerencia Operativa',
    contactEmail: 'admin@costadoradapremium.com',
    password: 'moonpalace',
    createdAt: '2025-01-15T12:00:00.000Z'
  }
];

const cloneTenants = (tenants) => tenants.map((tenant) => ({ ...tenant }));

const readLocalStorageValue = (key) => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
};

const readLocalStorageJSON = (key) => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`No se pudo leer el contenido almacenado en ${key}`, error);
    return undefined;
  }
};

const writeLocalStorageJSON = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

const writeLocalStorageValue = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (value === null || typeof value === 'undefined') {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, String(value));
};

export const loadBranding = () => {
  const stored = readLocalStorageJSON(BRANDING_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    return {
      branding: {
        hotelName: stored.hotelName || DEFAULT_BRANDING.hotelName,
        tagline: stored.tagline || DEFAULT_BRANDING.tagline,
        loginBackgroundUrl:
          typeof stored.loginBackgroundUrl === 'string' && stored.loginBackgroundUrl.trim().length > 0
            ? stored.loginBackgroundUrl
            : DEFAULT_BRANDING.loginBackgroundUrl
      },
      hasStoredValue: true
    };
  }
  if (stored === null) {
    return { branding: DEFAULT_BRANDING, hasStoredValue: false };
  }
  return { branding: DEFAULT_BRANDING, hasStoredValue: false };
};

export const loadDefaultBranding = () => {
  const storedDefault = readLocalStorageJSON(DEFAULT_BRANDING_STORAGE_KEY);
  if (storedDefault && typeof storedDefault === 'object') {
    return {
      hotelName: storedDefault.hotelName || DEFAULT_BRANDING.hotelName,
      tagline: storedDefault.tagline || DEFAULT_BRANDING.tagline,
      loginBackgroundUrl:
        typeof storedDefault.loginBackgroundUrl === 'string' && storedDefault.loginBackgroundUrl.trim().length > 0
          ? storedDefault.loginBackgroundUrl
          : DEFAULT_BRANDING.loginBackgroundUrl
    };
  }

  const storedActive = readLocalStorageJSON(BRANDING_STORAGE_KEY);
  const fallback = {
    hotelName: storedActive?.hotelName || DEFAULT_BRANDING.hotelName,
    tagline: storedActive?.tagline || DEFAULT_BRANDING.tagline,
    loginBackgroundUrl:
      typeof storedActive?.loginBackgroundUrl === 'string' && storedActive.loginBackgroundUrl.trim().length > 0
        ? storedActive.loginBackgroundUrl
        : DEFAULT_BRANDING.loginBackgroundUrl
  };
  if (typeof window !== 'undefined') {
    writeLocalStorageJSON(DEFAULT_BRANDING_STORAGE_KEY, fallback);
  }
  return fallback;
};

export const saveBranding = (branding) => {
  const payload = {
    hotelName: branding.hotelName || DEFAULT_BRANDING.hotelName,
    tagline: branding.tagline || DEFAULT_BRANDING.tagline,
    loginBackgroundUrl:
      typeof branding.loginBackgroundUrl === 'string' && branding.loginBackgroundUrl.trim().length > 0
        ? branding.loginBackgroundUrl
        : DEFAULT_BRANDING.loginBackgroundUrl
  };
  writeLocalStorageJSON(BRANDING_STORAGE_KEY, payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: payload }));
  }
  return payload;
};

export const saveDefaultBranding = (branding) => {
  const payload = {
    hotelName: branding.hotelName || DEFAULT_BRANDING.hotelName,
    tagline: branding.tagline || DEFAULT_BRANDING.tagline,
    loginBackgroundUrl:
      typeof branding.loginBackgroundUrl === 'string' && branding.loginBackgroundUrl.trim().length > 0
        ? branding.loginBackgroundUrl
        : DEFAULT_BRANDING.loginBackgroundUrl
  };
  writeLocalStorageJSON(DEFAULT_BRANDING_STORAGE_KEY, payload);
  return payload;
};

export const resetBranding = () => saveBranding(DEFAULT_BRANDING);

export const subscribeBranding = (callback) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event) => {
    const detail = event?.detail;
    if (detail) {
      callback(detail);
    } else {
      const { branding } = loadBranding();
      callback(branding);
    }
  };
  window.addEventListener(BRANDING_EVENT, handler);
  return () => window.removeEventListener(BRANDING_EVENT, handler);
};

export const loadTenants = () => {
  const stored = readLocalStorageJSON(TENANTS_STORAGE_KEY);
  if (Array.isArray(stored)) {
    const normalized = stored.map((tenant) => ({
      ...tenant,
      password: typeof tenant?.password === 'string' ? tenant.password : ''
    }));
    const needsSync = normalized.some((tenant, index) => tenant.password !== stored[index]?.password);
    if (needsSync && typeof window !== 'undefined') {
      writeLocalStorageJSON(TENANTS_STORAGE_KEY, normalized);
    }
    return normalized;
  }
  const seeded = cloneTenants(DEFAULT_TENANTS_REGISTRY).map((tenant) => ({
    ...tenant,
    password: typeof tenant?.password === 'string' ? tenant.password : ''
  }));
  if (typeof window !== 'undefined') {
    writeLocalStorageJSON(TENANTS_STORAGE_KEY, seeded);
  }
  return seeded;
};

export const saveTenants = (tenants) => {
  const payload = Array.isArray(tenants) ? tenants : [];
  writeLocalStorageJSON(TENANTS_STORAGE_KEY, payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TENANTS_EVENT, { detail: payload }));
  }
  return payload;
};

export const subscribeTenants = (callback) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event) => {
    if (Array.isArray(event?.detail)) {
      callback(event.detail);
    } else {
      callback(loadTenants());
    }
  };
  window.addEventListener(TENANTS_EVENT, handler);
  return () => window.removeEventListener(TENANTS_EVENT, handler);
};

export const createTenantRecord = ({
  hotelName,
  tagline,
  contactName,
  contactEmail,
  password
}) => {
  const namespace = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: namespace,
    namespace,
    hotelName: hotelName?.trim() || 'Nuevo hotel',
    tagline: tagline?.trim() || '',
    contactName: contactName?.trim() || '',
    contactEmail: contactEmail?.trim() || '',
    password: password?.trim() || '',
    createdAt: new Date().toISOString()
  };
};

export const loadActiveTenantNamespace = () => {
  const stored = readLocalStorageValue(ACTIVE_TENANT_STORAGE_KEY);
  if (typeof stored === 'string' && stored.trim().length > 0) {
    return stored;
  }
  return DEFAULT_TENANT_NAMESPACE;
};

export const saveActiveTenantNamespace = (namespace) => {
  const resolved = (namespace || '').trim() || DEFAULT_TENANT_NAMESPACE;
  writeLocalStorageValue(ACTIVE_TENANT_STORAGE_KEY, resolved);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_TENANT_EVENT, { detail: resolved }));
  }
  return resolved;
};

export const clearActiveTenantNamespace = () => {
  writeLocalStorageValue(ACTIVE_TENANT_STORAGE_KEY, null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_TENANT_EVENT, { detail: DEFAULT_TENANT_NAMESPACE }));
  }
  return DEFAULT_TENANT_NAMESPACE;
};

export const subscribeActiveTenantNamespace = (callback) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event) => {
    const detail = typeof event?.detail === 'string' ? event.detail : loadActiveTenantNamespace();
    callback(detail);
  };
  window.addEventListener(ACTIVE_TENANT_EVENT, handler);
  return () => window.removeEventListener(ACTIVE_TENANT_EVENT, handler);
};

export const findTenantByNamespace = (namespace) => {
  if (!namespace) {
    return null;
  }
  const normalized = String(namespace).trim();
  if (!normalized) {
    return null;
  }
  const tenants = loadTenants();
  return tenants.find((tenant) => tenant.namespace === normalized) || null;
};

export const applyTenantBranding = (namespace) => {
  const resolved = (namespace || '').trim() || DEFAULT_TENANT_NAMESPACE;

  if (resolved === DEFAULT_TENANT_NAMESPACE) {
    const defaultBranding = loadDefaultBranding();
    return saveBranding(defaultBranding);
  }

  const tenant = findTenantByNamespace(resolved);
  if (tenant) {
    return saveBranding({
      hotelName: tenant.hotelName || DEFAULT_BRANDING.hotelName,
      tagline: tenant.tagline || DEFAULT_BRANDING.tagline
    });
  }

  return saveBranding(DEFAULT_BRANDING);
};

export const BRANDING_EVENT_NAME = BRANDING_EVENT;
export const TENANTS_EVENT_NAME = TENANTS_EVENT;
export const BRANDING_STORAGE = BRANDING_STORAGE_KEY;
export const DEFAULT_BRANDING_STORAGE = DEFAULT_BRANDING_STORAGE_KEY;
export const TENANTS_STORAGE = TENANTS_STORAGE_KEY;
export const ACTIVE_TENANT_EVENT_NAME = ACTIVE_TENANT_EVENT;
export const ACTIVE_TENANT_STORAGE = ACTIVE_TENANT_STORAGE_KEY;
export const DEFAULT_TENANT = DEFAULT_TENANT_NAMESPACE;
export const DEFAULT_TENANTS = cloneTenants(DEFAULT_TENANTS_REGISTRY);

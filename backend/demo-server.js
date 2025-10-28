const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Usuarios temporales para demo multi-tenant
const demoUsers = [
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

// Ruta de login temporal (con y sin /api para compatibilidad)
app.post('/auth/login', (req, res) => {
  const { email, username, password } = req.body;

  const identifier = email || username;
  console.log('🔐 Intento de login:', { identifier, password });

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/Usuario y contraseña son requeridos'
    });
  }

  const matchedUser = findDemoUser(identifier);

  if (matchedUser && password === matchedUser.password) {
    const token = jwt.sign(
      { 
        id: matchedUser.id, 
        email: matchedUser.email, 
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      },
      'secreto_temporal_demo',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        nombre: matchedUser.nombre,
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      }
    });
    
    console.log('✅ Login exitoso para:', matchedUser.email);
  } else {
    res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
    
    console.log('❌ Login fallido para:', identifier);
  }
});

// Ruta para verificar token (con y sin /api para compatibilidad)
app.get('/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.verify(token, 'secreto_temporal_demo');
    const matchedUser = demoUsers.find((user) => user.id === decoded.id) || findDemoUser(decoded.email);

    if (!matchedUser) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    res.json({
      id: matchedUser.id,
      email: matchedUser.email,
      nombre: matchedUser.nombre,
      rol: matchedUser.rol,
      namespace: matchedUser.namespace
    });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

// Datos de demo para el dashboard
const dashboardData = {
  ocupacionPorcentaje: 78.5,
  unidadesOcupadas: 35,
  unidadesDisponibles: 15,
  unidadesMantenimiento: 2,
  unidadesLimpieza: 3,
  totalUnidades: 55,
  ingresosDiarios: 2850,
  adr: 95.50,
  checkinsPendientes: 12,
  checkinsCompletados: 8,
  personalActivo: 25,
  tareasAbiertas: 7,
  tendenciaOcupacion: '+5.2%',
  tendenciaIngresos: '+12.5%',
  tendenciaCheckins: '+3',
  tendenciaPersonal: 'Estable',
  fechasIngresos: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  ingresosSemana: [2800, 3200, 2900, 3500, 4100, 3800, 3300],
  ultimosCheckins: [
    { huesped: 'María García', unidad: 'A101', fecha: new Date() },
    { huesped: 'Juan Pérez', unidad: 'B205', fecha: new Date() },
    { huesped: 'Ana López', unidad: 'C303', fecha: new Date() }
  ],
  alertas: [
    { tipo: 'warning', mensaje: 'Check-in masivo programado para las 15:00', tiempo: '10 min' },
    { tipo: 'error', mensaje: 'Aire acondicionado averiado en Suite 201', tiempo: '25 min' },
    { tipo: 'info', mensaje: 'Inspección completada en Apartamento A101', tiempo: '1 hora' }
  ]
};

// Ruta del dashboard (con y sin /api para compatibilidad)
app.get('/dashboard/overview', (req, res) => {
  console.log('📊 Solicitando datos del dashboard');
  res.json(dashboardData);
});

// Rutas adicionales con prefijo /api para compatibilidad
app.post('/api/auth/login', (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  
  console.log('🔐 Intento de login (API):', { identifier, password });
  
  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/Usuario y contraseña son requeridos'
    });
  }

  const matchedUser = findDemoUser(identifier);
  
  if (matchedUser && password === matchedUser.password) {
    const token = jwt.sign(
      { 
        id: matchedUser.id, 
        email: matchedUser.email, 
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      },
      'secreto_temporal_demo',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        nombre: matchedUser.nombre,
        rol: matchedUser.rol,
        namespace: matchedUser.namespace
      }
    });
    
    console.log('✅ Login exitoso (API) para:', matchedUser.email);
  } else {
    res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
    
    console.log('❌ Login fallido (API) para:', identifier);
  }
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.verify(token, 'secreto_temporal_demo');
    const matchedUser = demoUsers.find((user) => user.id === decoded.id) || findDemoUser(decoded.email);

    if (!matchedUser) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    res.json({
      id: matchedUser.id,
      email: matchedUser.email,
      nombre: matchedUser.nombre,
      rol: matchedUser.rol,
      namespace: matchedUser.namespace
    });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

app.get('/api/dashboard/overview', (req, res) => {
  console.log('📊 Solicitando datos del dashboard (API)');
  res.json(dashboardData);
});

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PMS Backend funcionando (modo demo)',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log('🏨 PMS Backend Server (DEMO MODE)');
  console.log('🚀 ================================');
  console.log(`📡 Servidor ejecutándose en puerto ${PORT}`);
  console.log('🌐 URL: http://localhost:' + PORT);
  console.log('🔐 Usuario demo: admin@pms.com');
  console.log('🔑 Contraseña demo: admin123');
  console.log('🚀 ================================');
});
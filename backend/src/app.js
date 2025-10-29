// Archivo: backend/src/app.js
// Añade o reemplaza el bloque de configuración de CORS cerca del inicio del archivo,
// justo después de `app.use(express.json());` y antes de las rutas.

const express = require('express');
const cors = require('cors');
// ... otras imports existentes (socket.io, routes, etc.)

const app = express();

// Parse JSON
app.use(express.json());

// CORS: permitir tu frontend en Vercel y localhost para desarrollo.
// Usa la env var FRONTEND_ORIGIN para no hardcodear el dominio.
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'https://pmshotel-phi.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // permitir peticiones sin origin (herramientas server->server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('CORS blocked for origin:', origin);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Tenant-Namespace']
}));

// Opcional: responder explícitamente OPTIONS para todas las rutas (preflight)
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

// ... resto de middlewares y rutas
// Importar y usar los routers para las rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/alojamientos', require('./routes/alojamientos'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/colaboradores', require('./routes/colaboradores'));
app.use('/api/huespedes', require('./routes/huespedes'));
app.use('/api/ocupacion', require('./routes/ocupacion'));
// e.g. app.use('/api/auth', authRouter);
// Endpoint de salud para verificar el estado del backend
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PMS Backend funcionando',
    timestamp: new Date().toISOString()
  });
});
// inicio del servidor, socket.io, etc.

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});

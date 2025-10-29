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
// e.g. app.use('/api/auth', authRouter);
// inicio del servidor, socket.io, etc.

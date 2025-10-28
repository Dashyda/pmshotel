const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const ocupacionRoutes = require('./routes/ocupacion');
const alojamientosRoutes = require('./routes/alojamientos');
const colaboradoresRoutes = require('./routes/colaboradores');
const huespedesRoutes = require('./routes/huespedes');
const adminRoutes = require('./routes/admin');

// Importar middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Importar base de datos
const database = require('./config/database');

const app = express();
const server = createServer(app);

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes, intenta de nuevo más tarde'
  }
});

// Middleware global
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(morgan('combined'));
app.use(limiter);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para agregar io a req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a la base de datos
    await database.query('SELECT 1');
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: require('../package.json').version,
      database: 'Connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      database: 'Disconnected'
    });
  }
});

// Ruta de información de la API
app.get('/api', (req, res) => {
  res.json({
    name: 'PMS API',
    description: 'Sistema de Gestión de Propiedades - API REST',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      ocupacion: '/api/ocupacion',
      alojamientos: '/api/alojamientos',
      colaboradores: '/api/colaboradores',
      huespedes: '/api/huespedes',
      admin: '/api/admin'
    },
    documentation: 'https://docs.pms-system.com'
  });
});

// Rutas públicas (sin autenticación)
app.use('/api/auth', authRoutes);

// Rutas protegidas (requieren autenticación)
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/ocupacion', authMiddleware, ocupacionRoutes);
app.use('/api/alojamientos', authMiddleware, alojamientosRoutes);
app.use('/api/colaboradores', authMiddleware, colaboradoresRoutes);
app.use('/api/huespedes', authMiddleware, huespedesRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    timestamp: new Date().toISOString()
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

// Configurar eventos de Socket.IO
io.on('connection', (socket) => {
  console.log(`👤 Usuario conectado: ${socket.id}`);

  // Unirse a sala de dashboard para recibir actualizaciones
  socket.join('dashboard');

  // Enviar estadísticas iniciales
  socket.emit('dashboard_initial', {
    message: 'Conectado al dashboard en tiempo real',
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log(`👤 Usuario desconectado: ${socket.id}`);
  });

  // Solicitar actualización de dashboard
  socket.on('request_dashboard_update', async () => {
    try {
      const stats = await database.getDashboardStats();
      socket.emit('dashboard_update', {
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error enviando actualización de dashboard:', error);
      socket.emit('dashboard_error', {
        message: 'Error obteniendo estadísticas',
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Función para enviar actualizaciones en tiempo real
const broadcastDashboardUpdate = async () => {
  try {
    const stats = await database.getDashboardStats();
    io.to('dashboard').emit('dashboard_update', {
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en broadcast de dashboard:', error);
  }
};

// Programar actualización automática cada 30 segundos
setInterval(broadcastDashboardUpdate, 30000);

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('🔄 Cerrando servidor...');
  
  server.close(() => {
    console.log('🔌 Servidor HTTP cerrado');
  });
  
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Cerrando servidor...');
  
  server.close(() => {
    console.log('🔌 Servidor HTTP cerrado');
  });
  
  await database.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log('🏨 PMS Backend Server iniciado');
  console.log('🚀 ================================');
  console.log(`📡 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 API Docs: http://localhost:${PORT}/api`);
  console.log(`💾 Base de datos: ${process.env.DB_NAME}`);
  console.log(`🔄 Entorno: ${process.env.NODE_ENV}`);
  console.log('🚀 ================================');
});

module.exports = { app, server, io };
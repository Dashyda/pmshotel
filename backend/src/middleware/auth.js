const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'No se proporcionó token de autenticación'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario existe y está activo
      const user = await database.queryOne(
        `SELECT u.*, r.nombre as rol_nombre, r.nivel_acceso, r.permisos
        FROM usuarios u 
        JOIN roles r ON u.rol_id = r.id 
        WHERE u.id = $1 AND u.activo = TRUE`,
        [decoded.userId]
      );

      if (!user) {
        return res.status(401).json({
          error: 'Usuario no válido',
          message: 'El usuario no existe o está inactivo'
        });
      }

      // Agregar información del usuario a la request
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        nombre: user.nombre,
        apellidos: user.apellidos,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre,
        nivel_acceso: user.nivel_acceso,
        permisos: JSON.parse(user.permisos || '[]'),
        organizacion_id: user.organizacion_id,
        departamento_id: user.departamento_id
      };

      // Actualizar último acceso
      await database.query(
        'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
        [user.id]
      );

      next();
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token de autenticación no es válido o ha expirado'
      });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      error: 'Error del servidor',
      message: 'Error interno en el sistema de autenticación'
    });
  }
};

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Se requiere autenticación'
      });
    }

    const { permisos, nivel_acceso } = req.user;

    // Super admin tiene todos los permisos
    if (nivel_acceso === 'SUPER_ADMIN') {
      return next();
    }

    // Verificar si el usuario tiene el permiso específico
    if (permisos.includes('*') || permisos.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: 'Permisos insuficientes',
      message: `Se requiere el permiso '${permission}' para acceder a este recurso`
    });
  };
};

// Middleware para verificar nivel de acceso mínimo
const requireRole = (minLevel) => {
  const roleLevels = {
    'EMPLEADO': 1,
    'MANAGER': 2,
    'ADMIN': 3,
    'SUPER_ADMIN': 4
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Se requiere autenticación'
      });
    }

    const userLevel = roleLevels[req.user.nivel_acceso] || 0;
    const requiredLevel = roleLevels[minLevel] || 0;

    if (userLevel >= requiredLevel) {
      return next();
    }

    return res.status(403).json({
      error: 'Nivel de acceso insuficiente',
      message: `Se requiere nivel '${minLevel}' o superior`
    });
  };
};

module.exports = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.requireRole = requireRole;
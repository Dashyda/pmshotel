const errorHandler = (err, req, res, next) => {
  console.error('🚨 Error en la aplicación:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Error de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Error de validación',
      message: 'Los datos proporcionados no son válidos',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Error de base de datos MySQL
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({
          error: 'Conflicto de datos',
          message: 'Ya existe un registro con estos datos'
        });
      
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({
          error: 'Referencia inválida',
          message: 'Los datos hacen referencia a un registro que no existe'
        });
      
      case 'ER_ROW_IS_REFERENCED_2':
        return res.status(400).json({
          error: 'No se puede eliminar',
          message: 'Este registro está siendo utilizado por otros datos'
        });
      
      case 'ECONNREFUSED':
        return res.status(503).json({
          error: 'Error de conexión',
          message: 'No se puede conectar a la base de datos'
        });
      
      case 'ER_ACCESS_DENIED_ERROR':
        return res.status(503).json({
          error: 'Error de acceso',
          message: 'Credenciales de base de datos incorrectas'
        });
      
      default:
        console.error('Error de base de datos no manejado:', err.code, err.message);
    }
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'El token de autenticación no es válido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: 'El token de autenticación ha expirado'
    });
  }

  // Error de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON inválido',
      message: 'El formato de los datos enviados no es válido'
    });
  }

  // Error de archivo demasiado grande
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Archivo demasiado grande',
      message: 'El archivo excede el tamaño máximo permitido'
    });
  }

  // Error de rate limiting
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes',
      message: 'Has excedido el límite de solicitudes. Intenta de nuevo más tarde',
      retryAfter: err.retryAfter
    });
  }

  // Errores HTTP conocidos
  if (err.status || err.statusCode) {
    return res.status(err.status || err.statusCode).json({
      error: err.name || 'Error de la aplicación',
      message: err.message || 'Ha ocurrido un error'
    });
  }

  // Error 500 - Internal Server Error (por defecto)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: 'Ha ocurrido un error inesperado',
    ...(isDevelopment && {
      details: {
        message: err.message,
        stack: err.stack
      }
    })
  });
};

module.exports = errorHandler;
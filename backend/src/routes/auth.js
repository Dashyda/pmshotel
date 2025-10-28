const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const database = require('../config/database');

const router = express.Router();

// Validaciones
const loginValidation = [
  body('password').notEmpty().withMessage('La contraseña es requerida'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('username').optional().trim(),
  body().custom((value, { req }) => {
    const hasIdentifier = Boolean(
      (req.body.username && String(req.body.username).trim()) ||
      (req.body.email && String(req.body.email).trim())
    );

    if (!hasIdentifier) {
      throw new Error('Debes proporcionar un email o nombre de usuario');
    }

    return true;
  })
];

const registerValidation = [
  body('username').trim().isLength({ min: 3 }).withMessage('El username debe tener al menos 3 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('rol_id').isInt({ min: 1 }).withMessage('Rol inválido'),
  body('organizacion_id').isInt({ min: 1 }).withMessage('Organización inválida')
];

// POST /api/auth/login - Iniciar sesión
router.post('/login', loginValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Por favor revisa los datos enviados',
        details: errors.array()
      });
    }

    const { username, email, password } = req.body;
    const identifier = (username && String(username).trim()) || (email && String(email).trim()) || '';

    // Buscar usuario
    const user = await database.queryOne(
      `SELECT u.*, r.nombre as rol_nombre, r.nivel_acceso, r.permisos,
              o.nombre as organizacion_nombre
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       JOIN organizaciones o ON u.organizacion_id = o.id
       WHERE (u.username = ? OR u.email = ?) AND u.activo = TRUE`,
      [identifier, identifier]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        rol_id: user.rol_id,
        organizacion_id: user.organizacion_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Actualizar último acceso
    await database.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
      [user.id]
    );

    // Respuesta exitosa (sin incluir password_hash)
    const { password_hash, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        ...userWithoutPassword,
        permisos: JSON.parse(user.permisos || '[]')
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register - Registrar nuevo usuario (solo para admins)
router.post('/register', registerValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Por favor revisa los datos enviados',
        details: errors.array()
      });
    }

    const { username, email, password, nombre, apellidos, telefono, rol_id, organizacion_id, departamento_id } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await database.queryOne(
      'SELECT id FROM usuarios WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'Usuario ya existe',
        message: 'Ya existe un usuario con ese username o email'
      });
    }

    // Verificar que el rol y organización existen
    const role = await database.findById('roles', rol_id);
    const organization = await database.findById('organizaciones', organizacion_id);

    if (!role || !organization) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'El rol o la organización especificados no existen'
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const userData = {
      username,
      email,
      password_hash: passwordHash,
      nombre,
      apellidos: apellidos || null,
      telefono: telefono || null,
      rol_id,
      organizacion_id,
      departamento_id: departamento_id || null,
      activo: true
    };

    const result = await database.create('usuarios', userData);

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: result.insertId,
        username,
        email,
        nombre,
        apellidos,
        rol_nombre: role.nombre,
        organizacion_nombre: organization.nombre
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Renovar token
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'No se proporcionó token para renovar'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario sigue activo
      const user = await database.queryOne(
        `SELECT u.*, r.nombre as rol_nombre, r.nivel_acceso, r.permisos
         FROM usuarios u 
         JOIN roles r ON u.rol_id = r.id 
         WHERE u.id = ? AND u.activo = TRUE`,
        [decoded.userId]
      );

      if (!user) {
        return res.status(401).json({
          error: 'Usuario inválido',
          message: 'El usuario no existe o está inactivo'
        });
      }

      // Generar nuevo token
      const newToken = jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          rol_id: user.rol_id,
          organizacion_id: user.organizacion_id
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        message: 'Token renovado exitosamente',
        token: newToken
      });

    } catch (jwtError) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no es válido o ha expirado'
      });
    }

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', async (req, res) => {
  // En un sistema con tokens JWT, el logout se maneja en el frontend
  // eliminando el token del storage local
  res.json({
    message: 'Sesión cerrada exitosamente'
  });
});

// GET /api/auth/me - Obtener información del usuario actual
router.get('/me', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'No se proporcionó token de autenticación'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await database.queryOne(
        `SELECT u.id, u.username, u.email, u.nombre, u.apellidos, u.telefono, u.avatar_url,
                u.ultimo_acceso, u.fecha_creacion, r.nombre as rol_nombre, r.nivel_acceso, 
                r.permisos, o.nombre as organizacion_nombre, d.nombre as departamento_nombre
         FROM usuarios u 
         JOIN roles r ON u.rol_id = r.id 
         JOIN organizaciones o ON u.organizacion_id = o.id
         LEFT JOIN departamentos d ON u.departamento_id = d.id
         WHERE u.id = ? AND u.activo = TRUE`,
        [decoded.userId]
      );

      if (!user) {
        return res.status(401).json({
          error: 'Usuario inválido',
          message: 'El usuario no existe o está inactivo'
        });
      }

      res.json({
        user: {
          ...user,
          permisos: JSON.parse(user.permisos || '[]')
        }
      });

    } catch (jwtError) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no es válido o ha expirado'
      });
    }

  } catch (error) {
    next(error);
  }
});

// GET /api/auth/verify - Verificar si un token es válido
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        valid: false,
        message: 'No se proporcionó token'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario existe y está activo
      const user = await database.queryOne(
        'SELECT id FROM usuarios WHERE id = ? AND activo = TRUE',
        [decoded.userId]
      );

      res.json({
        valid: !!user,
        message: user ? 'Token válido' : 'Usuario inválido'
      });

    } catch (jwtError) {
      res.json({
        valid: false,
        message: 'Token inválido o expirado'
      });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
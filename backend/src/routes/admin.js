const express = require('express');
const { body, validationResult, query } = require('express-validator');
const database = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de rol de administrador a todas las rutas
router.use(requireRole('ADMIN'));

// GET /api/admin/usuarios - Listar usuarios
router.get('/usuarios', async (req, res, next) => {
  try {
    const usuarios = await database.query(`
      SELECT u.id, u.username, u.email, u.nombre, u.apellidos, u.telefono,
        u.ultimo_acceso, u.activo, u.fecha_creacion,
        r.nombre as rol_nombre, r.nivel_acceso,
        o.nombre as organizacion_nombre,
        d.nombre as departamento_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      JOIN organizaciones o ON u.organizacion_id = o.id
      LEFT JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.organizacion_id = ?
      ORDER BY u.fecha_creacion DESC
    `, [req.user.organizacion_id]);

    res.json({
      message: 'Usuarios obtenidos exitosamente',
      data: usuarios
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/roles - Listar roles
router.get('/roles', async (req, res, next) => {
  try {
    const roles = await database.findAll('roles', {}, '*', 'nivel_acceso ASC, nombre ASC');
    res.json({
      message: 'Roles obtenidos exitosamente',
      data: roles
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/auditoria - Log de auditoría
router.get('/auditoria', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('tabla').optional().isString(),
  query('accion').optional().isIn(['INSERT', 'UPDATE', 'DELETE'])
], async (req, res, next) => {
  try {
    const { page = 1, limit = 50, tabla, accion } = req.query;
    
    let whereConditions = ['1 = 1'];
    let params = [];

    if (tabla) {
      whereConditions.push('a.tabla = ?');
      params.push(tabla);
    }

    if (accion) {
      whereConditions.push('a.accion = ?');
      params.push(accion);
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const auditoria = await database.query(`
      SELECT a.*, u.username, u.nombre, u.apellidos
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE ${whereClause}
      ORDER BY a.fecha_accion DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await database.queryOne(`
      SELECT COUNT(*) as total FROM auditoria a WHERE ${whereClause}
    `, params);

    res.json({
      message: 'Log de auditoría obtenido exitosamente',
      data: auditoria,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
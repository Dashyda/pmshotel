const express = require('express');
const { body, validationResult, query } = require('express-validator');
const database = require('../config/database');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/alojamientos/complejos - Listar complejos
router.get('/complejos', async (req, res, next) => {
  try {
    const complejos = await database.query(`
      SELECT c.*, 
        COUNT(u.id) as total_unidades,
        SUM(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as unidades_disponibles,
        SUM(CASE WHEN u.estado = 'OCUPADA' THEN 1 ELSE 0 END) as unidades_ocupadas
      FROM complejos c
      LEFT JOIN unidades u ON c.id = u.complejo_id AND u.activo = TRUE
      WHERE c.organizacion_id = ? AND c.activo = TRUE
      GROUP BY c.id
      ORDER BY c.nombre
    `, [req.user.organizacion_id]);

    res.json({
      message: 'Complejos obtenidos exitosamente',
      data: complejos
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/alojamientos/unidades - Listar unidades
router.get('/unidades', [
  query('complejo_id').optional().isInt({ min: 1 }),
  query('estado').optional().isIn(['DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO', 'FUERA_SERVICIO']),
  query('tipo_unidad_id').optional().isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const { complejo_id, estado, tipo_unidad_id, page = 1, limit = 20 } = req.query;
    
    let whereConditions = ['c.organizacion_id = ? AND u.activo = TRUE'];
    let params = [req.user.organizacion_id];

    if (complejo_id) {
      whereConditions.push('u.complejo_id = ?');
      params.push(complejo_id);
    }

    if (estado) {
      whereConditions.push('u.estado = ?');
      params.push(estado);
    }

    if (tipo_unidad_id) {
      whereConditions.push('u.tipo_unidad_id = ?');
      params.push(tipo_unidad_id);
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const unidades = await database.query(`
      SELECT u.*, c.nombre as complejo_nombre,
        tv.nombre as tipo_vivienda, tu.nombre as tipo_unidad,
        r.numero_reserva, r.fecha_checkout, 
        h.nombre as huesped_actual_nombre, h.apellidos as huesped_actual_apellidos
      FROM unidades u
      JOIN complejos c ON u.complejo_id = c.id
      JOIN tipos_viviendas tv ON u.tipo_vivienda_id = tv.id
      JOIN tipos_unidades tu ON u.tipo_unidad_id = tu.id
      LEFT JOIN reservas r ON u.id = r.unidad_id AND r.estado = 'CHECK_IN'
      LEFT JOIN huespedes h ON r.huesped_principal_id = h.id
      WHERE ${whereClause}
      ORDER BY c.nombre, u.numero_unidad
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await database.queryOne(`
      SELECT COUNT(*) as total
      FROM unidades u
      JOIN complejos c ON u.complejo_id = c.id
      WHERE ${whereClause}
    `, params);

    res.json({
      message: 'Unidades obtenidas exitosamente',
      data: unidades,
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

// POST /api/alojamientos/unidades - Crear nueva unidad
router.post('/unidades', requirePermission('alojamientos'), [
  body('complejo_id').isInt({ min: 1 }).withMessage('Complejo requerido'),
  body('tipo_vivienda_id').isInt({ min: 1 }).withMessage('Tipo de vivienda requerido'),
  body('tipo_unidad_id').isInt({ min: 1 }).withMessage('Tipo de unidad requerido'),
  body('numero_unidad').trim().notEmpty().withMessage('Número de unidad requerido'),
  body('capacidad_maxima').isInt({ min: 1 }).withMessage('Capacidad máxima inválida'),
  body('precio_base').isFloat({ min: 0 }).withMessage('Precio base inválido')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const unidadData = {
      ...req.body,
      estado: 'DISPONIBLE',
      activo: true
    };

    const result = await database.create('unidades', unidadData);

    res.status(201).json({
      message: 'Unidad creada exitosamente',
      data: { id: result.insertId, ...unidadData }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
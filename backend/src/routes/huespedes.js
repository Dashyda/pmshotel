const express = require('express');
const { body, validationResult, query } = require('express-validator');
const database = require('../config/database');

const router = express.Router();

// GET /api/huespedes - Listar huéspedes
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('vip').optional().isBoolean()
], async (req, res, next) => {
  try {
    const { page = 1, limit = 20, vip, buscar } = req.query;
    
    let whereConditions = ['1 = 1'];
    let params = [];

    if (vip !== undefined) {
      whereConditions.push('h.vip = ?');
      params.push(vip === 'true');
    }

    if (buscar) {
      whereConditions.push('(h.nombre LIKE ? OR h.apellidos LIKE ? OR h.email LIKE ? OR h.numero_documento LIKE ?)');
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const huespedes = await database.query(`
      SELECT h.*,
        COUNT(r.id) as total_reservas,
        MAX(r.fecha_checkout) as ultima_estancia,
        SUM(r.precio_total) as gasto_total
      FROM huespedes h
      LEFT JOIN reservas r ON h.id = r.huesped_principal_id
      WHERE ${whereClause}
      GROUP BY h.id
      ORDER BY h.fecha_creacion DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await database.queryOne(`
      SELECT COUNT(*) as total FROM huespedes h WHERE ${whereClause}
    `, params);

    res.json({
      message: 'Huéspedes obtenidos exitosamente',
      data: huespedes,
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

// POST /api/huespedes - Crear huésped
router.post('/', [
  body('tipo_documento').isIn(['DNI', 'PASAPORTE', 'CEDULA', 'OTRO']).withMessage('Tipo de documento inválido'),
  body('numero_documento').trim().notEmpty().withMessage('Número de documento requerido'),
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('email').optional().isEmail().withMessage('Email inválido')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const result = await database.create('huespedes', req.body);

    res.status(201).json({
      message: 'Huésped creado exitosamente',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
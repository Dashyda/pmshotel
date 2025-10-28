const express = require('express');
const { body, validationResult, query } = require('express-validator');
const database = require('../config/database');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/colaboradores - Listar colaboradores
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('estado').optional().isIn(['ACTIVO', 'INACTIVO', 'VACACIONES', 'LICENCIA', 'DESPEDIDO']),
  query('tipo_colaborador_id').optional().isInt({ min: 1 }),
  query('departamento_id').optional().isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const { page = 1, limit = 20, estado, tipo_colaborador_id, departamento_id, buscar } = req.query;
    
    let whereConditions = ['c.organizacion_id = ? AND c.activo = TRUE'];
    let params = [req.user.organizacion_id];

    if (estado) {
      whereConditions.push('c.estado = ?');
      params.push(estado);
    }

    if (tipo_colaborador_id) {
      whereConditions.push('c.tipo_colaborador_id = ?');
      params.push(tipo_colaborador_id);
    }

    if (departamento_id) {
      whereConditions.push('ca.departamento_id = ?');
      params.push(departamento_id);
    }

    if (buscar) {
      whereConditions.push('(c.nombre LIKE ? OR c.apellidos LIKE ? OR c.numero_empleado LIKE ?)');
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    const colaboradores = await database.query(`
      SELECT c.*, tc.nombre as tipo_colaborador, ca.nombre as cargo,
        d.nombre as departamento_nombre,
        t.nombre as turno_nombre, t.hora_inicio, t.hora_fin
      FROM colaboradores c
      JOIN tipos_colaborador tc ON c.tipo_colaborador_id = tc.id
      JOIN cargos ca ON c.cargo_id = ca.id
      LEFT JOIN departamentos d ON ca.departamento_id = d.id
      LEFT JOIN colaborador_turnos ct ON c.id = ct.colaborador_id AND ct.activo = TRUE
      LEFT JOIN turnos t ON ct.turno_id = t.id
      WHERE ${whereClause}
      ORDER BY c.nombre, c.apellidos
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await database.queryOne(`
      SELECT COUNT(*) as total
      FROM colaboradores c
      JOIN cargos ca ON c.cargo_id = ca.id
      WHERE ${whereClause}
    `, params);

    res.json({
      message: 'Colaboradores obtenidos exitosamente',
      data: colaboradores,
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

// GET /api/colaboradores/turnos - Listar turnos
router.get('/turnos', async (req, res, next) => {
  try {
    const turnos = await database.findAll('turnos', {}, '*', 'nombre ASC');
    res.json({
      message: 'Turnos obtenidos exitosamente',
      data: turnos
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/colaboradores - Crear colaborador
router.post('/', requirePermission('colaboradores'), [
  body('tipo_colaborador_id').isInt({ min: 1 }).withMessage('Tipo de colaborador requerido'),
  body('cargo_id').isInt({ min: 1 }).withMessage('Cargo requerido'),
  body('numero_documento').trim().notEmpty().withMessage('Número de documento requerido'),
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('fecha_ingreso').isDate().withMessage('Fecha de ingreso inválida')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const colaboradorData = {
      ...req.body,
      organizacion_id: req.user.organizacion_id,
      estado: 'ACTIVO',
      activo: true
    };

    const result = await database.create('colaboradores', colaboradorData);

    res.status(201).json({
      message: 'Colaborador creado exitosamente',
      data: { id: result.insertId, ...colaboradorData }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
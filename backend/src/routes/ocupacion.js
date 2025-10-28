const express = require('express');
const { body, validationResult, query } = require('express-validator');
const database = require('../config/database');
const moment = require('moment');

const router = express.Router();

// GET /api/ocupacion/reservas - Listar reservas con filtros
router.get('/reservas', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100'),
  query('estado').optional().isIn(['PENDIENTE', 'CONFIRMADA', 'CHECK_IN', 'CHECK_OUT', 'CANCELADA', 'NO_SHOW']),
  query('fecha_desde').optional().isDate(),
  query('fecha_hasta').optional().isDate(),
  query('complejo_id').optional().isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Parámetros inválidos',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      estado,
      fecha_desde,
      fecha_hasta,
      complejo_id,
      buscar
    } = req.query;

    const offset = (page - 1) * limit;
    
    let whereConditions = ['1 = 1'];
    let params = [];

    // Filtrar por organización del usuario
    whereConditions.push('c.organizacion_id = ?');
    params.push(req.user.organizacion_id);

    if (estado) {
      whereConditions.push('r.estado = ?');
      params.push(estado);
    }

    if (fecha_desde) {
      whereConditions.push('r.fecha_checkin >= ?');
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      whereConditions.push('r.fecha_checkout <= ?');
      params.push(fecha_hasta);
    }

    if (complejo_id) {
      whereConditions.push('r.complejo_id = ?');
      params.push(complejo_id);
    }

    if (buscar) {
      whereConditions.push('(r.numero_reserva LIKE ? OR h.nombre LIKE ? OR h.apellidos LIKE ? OR h.email LIKE ?)');
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.join(' AND ');

    // Consulta principal
    const reservasQuery = `
      SELECT 
        r.id, r.numero_reserva, r.fecha_checkin, r.fecha_checkout,
        r.hora_checkin, r.hora_checkout, r.numero_huespedes, r.numero_adultos, r.numero_ninos,
        r.precio_total, r.precio_por_noche, r.estado, r.canal_reserva, r.observaciones,
        r.fecha_creacion, r.fecha_actualizacion,
        h.id as huesped_id, h.nombre as huesped_nombre, h.apellidos as huesped_apellidos,
        h.email as huesped_email, h.telefono as huesped_telefono,
        u.id as unidad_id, u.numero_unidad, u.piso,
        c.id as complejo_id, c.nombre as complejo_nombre,
        tv.nombre as tipo_vivienda, tu.nombre as tipo_unidad
      FROM reservas r
      JOIN huespedes h ON r.huesped_principal_id = h.id
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      JOIN tipos_viviendas tv ON u.tipo_vivienda_id = tv.id
      JOIN tipos_unidades tu ON u.tipo_unidad_id = tu.id
      WHERE ${whereClause}
      ORDER BY r.fecha_checkin DESC, r.hora_checkin ASC
      LIMIT ? OFFSET ?
    `;

    // Consulta para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reservas r
      JOIN complejos c ON r.complejo_id = c.id
      JOIN huespedes h ON r.huesped_principal_id = h.id
      WHERE ${whereClause}
    `;

    const [reservas, countResult] = await Promise.all([
      database.query(reservasQuery, [...params, parseInt(limit), parseInt(offset)]),
      database.query(countQuery, params)
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Reservas obtenidas exitosamente',
      data: reservas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/ocupacion/reservas - Crear nueva reserva
router.post('/reservas', [
  body('complejo_id').isInt({ min: 1 }).withMessage('Complejo requerido'),
  body('unidad_id').isInt({ min: 1 }).withMessage('Unidad requerida'),
  body('huesped_principal_id').isInt({ min: 1 }).withMessage('Huésped principal requerido'),
  body('fecha_checkin').isDate().withMessage('Fecha de check-in inválida'),
  body('fecha_checkout').isDate().withMessage('Fecha de check-out inválida'),
  body('numero_huespedes').isInt({ min: 1 }).withMessage('Número de huéspedes debe ser al menos 1'),
  body('numero_adultos').isInt({ min: 1 }).withMessage('Número de adultos debe ser al menos 1'),
  body('precio_por_noche').isFloat({ min: 0 }).withMessage('Precio por noche inválido')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const {
      complejo_id,
      unidad_id,
      huesped_principal_id,
      fecha_checkin,
      fecha_checkout,
      hora_checkin,
      hora_checkout,
      numero_huespedes,
      numero_adultos,
      numero_ninos = 0,
      precio_por_noche,
      canal_reserva = 'DIRECTO',
      observaciones
    } = req.body;

    // Validar fechas
    const checkinDate = moment(fecha_checkin);
    const checkoutDate = moment(fecha_checkout);

    if (checkoutDate.isSameOrBefore(checkinDate)) {
      return res.status(400).json({
        error: 'Fechas inválidas',
        message: 'La fecha de checkout debe ser posterior al checkin'
      });
    }

    // Verificar disponibilidad de la unidad
    const conflictQuery = `
      SELECT COUNT(*) as conflictos
      FROM reservas 
      WHERE unidad_id = ? 
        AND estado NOT IN ('CANCELADA', 'CHECK_OUT')
        AND (
          (fecha_checkin <= ? AND fecha_checkout > ?) OR
          (fecha_checkin < ? AND fecha_checkout >= ?) OR
          (fecha_checkin >= ? AND fecha_checkout <= ?)
        )
    `;

    const conflictResult = await database.queryOne(conflictQuery, [
      unidad_id, fecha_checkin, fecha_checkin,
      fecha_checkout, fecha_checkout,
      fecha_checkin, fecha_checkout
    ]);

    if (conflictResult.conflictos > 0) {
      return res.status(409).json({
        error: 'Unidad no disponible',
        message: 'La unidad ya está reservada para esas fechas'
      });
    }

    // Calcular precio total
    const noches = checkoutDate.diff(checkinDate, 'days');
    const precio_total = noches * precio_por_noche;

    // Generar número de reserva único
    const numero_reserva = `RES${Date.now()}`;

    const reservaData = {
      complejo_id,
      unidad_id,
      huesped_principal_id,
      numero_reserva,
      fecha_checkin,
      fecha_checkout,
      hora_checkin: hora_checkin || '15:00:00',
      hora_checkout: hora_checkout || '11:00:00',
      numero_huespedes,
      numero_adultos,
      numero_ninos,
      precio_total,
      precio_por_noche,
      estado: 'PENDIENTE',
      canal_reserva,
      observaciones
    };

    const result = await database.create('reservas', reservaData);

    // Obtener la reserva creada con información completa
    const nuevaReserva = await database.queryOne(`
      SELECT 
        r.*, h.nombre as huesped_nombre, h.apellidos as huesped_apellidos,
        u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_principal_id = h.id
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.id = ?
    `, [result.insertId]);

    // Notificar vía Socket.IO
    req.io.to('dashboard').emit('nueva_reserva', {
      reserva: nuevaReserva,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Reserva creada exitosamente',
      data: nuevaReserva
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/ocupacion/reservas/:id/checkin - Hacer check-in
router.put('/reservas/:id/checkin', [
  body('observaciones').optional().isString()
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;

    // Verificar que la reserva existe y puede hacer check-in
    const reserva = await database.queryOne(`
      SELECT r.*, u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.id = ? AND c.organizacion_id = ?
    `, [id, req.user.organizacion_id]);

    if (!reserva) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
        message: 'La reserva no existe o no tienes permisos para acceder'
      });
    }

    if (reserva.estado !== 'CONFIRMADA') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'Solo se puede hacer check-in de reservas confirmadas'
      });
    }

    // Verificar fecha
    const hoy = moment().format('YYYY-MM-DD');
    if (moment(reserva.fecha_checkin).isAfter(hoy)) {
      return res.status(400).json({
        error: 'Check-in prematuro',
        message: 'No se puede hacer check-in antes de la fecha programada'
      });
    }

    await database.transaction(async (connection) => {
      // Actualizar estado de la reserva
      await connection.execute(
        'UPDATE reservas SET estado = ?, observaciones = ? WHERE id = ?',
        ['CHECK_IN', observaciones || reserva.observaciones, id]
      );

      // Actualizar estado de la unidad
      await connection.execute(
        'UPDATE unidades SET estado = ? WHERE id = ?',
        ['OCUPADA', reserva.unidad_id]
      );

      // Crear registro en histórico de ocupación
      await connection.execute(`
        INSERT INTO historico_ocupacion (reserva_id, unidad_id, fecha, estado_ocupacion, precio_noche)
        VALUES (?, ?, CURDATE(), 'OCUPADA', ?)
      `, [id, reserva.unidad_id, reserva.precio_por_noche]);
    });

    // Notificar vía Socket.IO
    req.io.to('dashboard').emit('checkin_realizado', {
      reserva_id: id,
      numero_reserva: reserva.numero_reserva,
      unidad: reserva.numero_unidad,
      complejo: reserva.complejo_nombre,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Check-in realizado exitosamente',
      data: {
        reserva_id: id,
        estado: 'CHECK_IN',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/ocupacion/reservas/:id/checkout - Hacer check-out
router.put('/reservas/:id/checkout', [
  body('observaciones').optional().isString(),
  body('gastos_extras').optional().isFloat({ min: 0 })
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observaciones, gastos_extras = 0 } = req.body;

    // Verificar que la reserva existe y puede hacer check-out
    const reserva = await database.queryOne(`
      SELECT r.*, u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.id = ? AND c.organizacion_id = ?
    `, [id, req.user.organizacion_id]);

    if (!reserva) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
        message: 'La reserva no existe o no tienes permisos para acceder'
      });
    }

    if (reserva.estado !== 'CHECK_IN') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'Solo se puede hacer check-out de reservas con check-in realizado'
      });
    }

    await database.transaction(async (connection) => {
      // Actualizar estado de la reserva
      const precio_final = reserva.precio_total + gastos_extras;
      await connection.execute(
        'UPDATE reservas SET estado = ?, precio_total = ?, observaciones = ? WHERE id = ?',
        ['CHECK_OUT', precio_final, observaciones || reserva.observaciones, id]
      );

      // Actualizar estado de la unidad a disponible
      await connection.execute(
        'UPDATE unidades SET estado = ? WHERE id = ?',
        ['DISPONIBLE', reserva.unidad_id]
      );

      // Programar inspección automática
      const fechaInspeccion = moment().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss');
      await connection.execute(`
        INSERT INTO inspecciones (unidad_id, usuario_id, tipo_inspeccion, estado, fecha_programada, checklist)
        VALUES (?, ?, 'CHECK_OUT', 'PENDIENTE', ?, ?)
      `, [
        reserva.unidad_id, 
        req.user.id, 
        fechaInspeccion,
        JSON.stringify({
          limpieza_general: false,
          bano_limpio: false,
          cama_hecha: false,
          amenidades_completas: false,
          electrodomesticos_ok: false,
          mobiliario_ok: false
        })
      ]);
    });

    // Notificar vía Socket.IO
    req.io.to('dashboard').emit('checkout_realizado', {
      reserva_id: id,
      numero_reserva: reserva.numero_reserva,
      unidad: reserva.numero_unidad,
      complejo: reserva.complejo_nombre,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Check-out realizado exitosamente',
      data: {
        reserva_id: id,
        estado: 'CHECK_OUT',
        precio_final: reserva.precio_total + gastos_extras,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/ocupacion/calendario - Vista de calendario de ocupación
router.get('/calendario', [
  query('fecha_inicio').isDate().withMessage('Fecha de inicio requerida'),
  query('fecha_fin').isDate().withMessage('Fecha de fin requerida'),
  query('complejo_id').optional().isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Parámetros inválidos',
        details: errors.array()
      });
    }

    const { fecha_inicio, fecha_fin, complejo_id } = req.query;

    let whereComplejo = '';
    const params = [req.user.organizacion_id, fecha_inicio, fecha_fin];

    if (complejo_id) {
      whereComplejo = 'AND c.id = ?';
      params.push(complejo_id);
    }

    const calendarioQuery = `
      SELECT 
        u.id as unidad_id, u.numero_unidad, u.piso, u.capacidad_maxima,
        c.id as complejo_id, c.nombre as complejo_nombre,
        tv.nombre as tipo_vivienda, tu.nombre as tipo_unidad,
        r.id as reserva_id, r.numero_reserva, r.fecha_checkin, r.fecha_checkout,
        r.estado as reserva_estado, r.numero_huespedes,
        h.nombre as huesped_nombre, h.apellidos as huesped_apellidos
      FROM unidades u
      JOIN complejos c ON u.complejo_id = c.id
      JOIN tipos_viviendas tv ON u.tipo_vivienda_id = tv.id
      JOIN tipos_unidades tu ON u.tipo_unidad_id = tu.id
      LEFT JOIN reservas r ON u.id = r.unidad_id 
        AND r.estado NOT IN ('CANCELADA') 
        AND r.fecha_checkin <= ? 
        AND r.fecha_checkout > ?
      LEFT JOIN huespedes h ON r.huesped_principal_id = h.id
      WHERE c.organizacion_id = ? 
        AND u.activo = TRUE 
        ${whereComplejo}
      ORDER BY c.nombre, u.numero_unidad
    `;

    const calendario = await database.query(calendarioQuery, [fecha_fin, fecha_inicio, ...params]);

    // Agrupar por complejo
    const complejos = {};
    calendario.forEach(item => {
      if (!complejos[item.complejo_id]) {
        complejos[item.complejo_id] = {
          id: item.complejo_id,
          nombre: item.complejo_nombre,
          unidades: []
        };
      }

      const unidad = {
        id: item.unidad_id,
        numero_unidad: item.numero_unidad,
        piso: item.piso,
        capacidad_maxima: item.capacidad_maxima,
        tipo_vivienda: item.tipo_vivienda,
        tipo_unidad: item.tipo_unidad,
        reserva: item.reserva_id ? {
          id: item.reserva_id,
          numero_reserva: item.numero_reserva,
          fecha_checkin: item.fecha_checkin,
          fecha_checkout: item.fecha_checkout,
          estado: item.reserva_estado,
          numero_huespedes: item.numero_huespedes,
          huesped_nombre: item.huesped_nombre,
          huesped_apellidos: item.huesped_apellidos
        } : null
      };

      complejos[item.complejo_id].unidades.push(unidad);
    });

    res.json({
      message: 'Calendario de ocupación obtenido exitosamente',
      data: {
        periodo: {
          fecha_inicio,
          fecha_fin
        },
        complejos: Object.values(complejos)
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
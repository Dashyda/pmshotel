const express = require('express');
const database = require('../config/database');
const moment = require('moment');

const router = express.Router();

// GET /api/dashboard/stats - Obtener estadísticas principales del dashboard
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await database.getDashboardStats();
    
    // Calcular ADR (Average Daily Rate)
    const adrQuery = `
      SELECT AVG(precio_por_noche) as adr
      FROM reservas 
      WHERE fecha_checkin >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND estado NOT IN ('CANCELADA', 'NO_SHOW')
    `;
    const adrResult = await database.queryOne(adrQuery);
    
    stats.financiero = {
      ingresos_hoy: stats.movimientos.ingresos,
      adr: parseFloat(adrResult.adr || 0).toFixed(2)
    };

    res.json({
      message: 'Estadísticas obtenidas exitosamente',
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/ocupacion-semanal - Gráfico de ocupación semanal
router.get('/ocupacion-semanal', async (req, res, next) => {
  try {
    const ocupacionData = await database.getOcupacionSemanal();
    
    // Preparar datos para el gráfico
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const datos = diasSemana.map((dia, index) => {
      const dataDay = ocupacionData.find(d => d.dia_numero === index) || {};
      return {
        dia,
        unidades_ocupadas: dataDay.unidades_ocupadas || 0,
        total_unidades: dataDay.total_unidades || 0,
        porcentaje: dataDay.total_unidades > 0 ? 
          ((dataDay.unidades_ocupadas / dataDay.total_unidades) * 100).toFixed(1) : 0
      };
    });

    res.json({
      message: 'Datos de ocupación semanal obtenidos exitosamente',
      data: datos
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/ingresos-mensuales - Gráfico de ingresos mensuales
router.get('/ingresos-mensuales', async (req, res, next) => {
  try {
    const ingresosData = await database.getIngresosMensuales();
    
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const datos = ingresosData.map(item => ({
      mes: meses[item.mes - 1],
      año: item.año,
      ingresos: parseFloat(item.ingresos_totales || 0),
      reservas: item.total_reservas,
      adr: parseFloat(item.adr || 0).toFixed(2)
    }));

    res.json({
      message: 'Datos de ingresos mensuales obtenidos exitosamente',
      data: datos
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/movimientos-hoy - Llegadas y salidas del día
router.get('/movimientos-hoy', async (req, res, next) => {
  try {
    const llegadasQuery = `
      SELECT r.id, r.numero_reserva, r.hora_checkin, r.numero_huespedes, r.estado,
             h.nombre, h.apellidos, h.telefono,
             u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_principal_id = h.id
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.fecha_checkin = CURDATE() 
        AND r.estado IN ('CONFIRMADA', 'CHECK_IN')
      ORDER BY r.hora_checkin ASC
    `;

    const salidasQuery = `
      SELECT r.id, r.numero_reserva, r.hora_checkout, r.numero_huespedes, r.estado,
             h.nombre, h.apellidos, h.telefono,
             u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_principal_id = h.id
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.fecha_checkout = CURDATE() 
        AND r.estado = 'CHECK_IN'
      ORDER BY r.hora_checkout ASC
    `;

    const [llegadas, salidas] = await Promise.all([
      database.query(llegadasQuery),
      database.query(salidasQuery)
    ]);

    res.json({
      message: 'Movimientos del día obtenidos exitosamente',
      data: {
        llegadas,
        salidas,
        resumen: {
          total_llegadas: llegadas.length,
          total_salidas: salidas.length,
          fecha: moment().format('YYYY-MM-DD')
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/alertas - Obtener alertas y notificaciones
router.get('/alertas', async (req, res, next) => {
  try {
    // Novedades urgentes
    const novedadesQuery = `
      SELECT n.id, n.titulo, n.descripcion, n.prioridad, n.fecha_reporte,
             n.fecha_vencimiento, u.numero_unidad, c.nombre as complejo_nombre,
             tn.nombre as tipo_novedad, tn.color_hex
      FROM novedades n
      JOIN unidades u ON n.unidad_id = u.id
      JOIN complejos c ON u.complejo_id = c.id
      JOIN tipos_novedades tn ON n.tipo_novedad_id = tn.id
      WHERE n.estado IN ('ABIERTA', 'EN_PROGRESO')
        AND (n.prioridad IN ('ALTA', 'CRITICA') OR n.fecha_vencimiento <= DATE_ADD(NOW(), INTERVAL 24 HOUR))
      ORDER BY 
        CASE n.prioridad 
          WHEN 'CRITICA' THEN 1 
          WHEN 'ALTA' THEN 2 
          WHEN 'MEDIA' THEN 3 
          ELSE 4 
        END,
        n.fecha_vencimiento ASC
      LIMIT 10
    `;

    // Inspecciones pendientes urgentes
    const inspeccionesQuery = `
      SELECT i.id, i.tipo_inspeccion, i.fecha_programada, i.estado,
             u.numero_unidad, c.nombre as complejo_nombre,
             us.nombre as usuario_nombre
      FROM inspecciones i
      JOIN unidades u ON i.unidad_id = u.id
      JOIN complejos c ON u.complejo_id = c.id
      JOIN usuarios us ON i.usuario_id = us.id
      WHERE i.estado = 'PENDIENTE'
        AND i.fecha_programada <= DATE_ADD(NOW(), INTERVAL 4 HOUR)
      ORDER BY i.fecha_programada ASC
      LIMIT 5
    `;

    // Check-ins próximos (próximas 2 horas)
    const checkinProximosQuery = `
      SELECT r.id, r.numero_reserva, r.hora_checkin, r.numero_huespedes,
             h.nombre, h.apellidos, h.telefono,
             u.numero_unidad, c.nombre as complejo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_principal_id = h.id
      JOIN unidades u ON r.unidad_id = u.id
      JOIN complejos c ON r.complejo_id = c.id
      WHERE r.fecha_checkin = CURDATE() 
        AND r.estado = 'CONFIRMADA'
        AND r.hora_checkin <= TIME(DATE_ADD(NOW(), INTERVAL 2 HOUR))
        AND r.hora_checkin >= TIME(NOW())
      ORDER BY r.hora_checkin ASC
      LIMIT 5
    `;

    const [novedades, inspecciones, checkins] = await Promise.all([
      database.query(novedadesQuery),
      database.query(inspeccionesQuery),
      database.query(checkinProximosQuery)
    ]);

    const alertas = [];

    // Procesar novedades
    novedades.forEach(novedad => {
      const horasVencimiento = moment(novedad.fecha_vencimiento).diff(moment(), 'hours');
      let tipo = 'warning';
      
      if (novedad.prioridad === 'CRITICA') tipo = 'error';
      else if (horasVencimiento <= 0) tipo = 'error';
      else if (horasVencimiento <= 6) tipo = 'warning';
      else tipo = 'info';

      alertas.push({
        id: `novedad_${novedad.id}`,
        tipo,
        titulo: `${novedad.tipo_novedad}: ${novedad.titulo}`,
        mensaje: `${novedad.complejo_nombre} - Unidad ${novedad.numero_unidad}`,
        tiempo: horasVencimiento > 0 ? `${horasVencimiento}h restantes` : 'Vencida',
        prioridad: novedad.prioridad,
        categoria: 'mantenimiento'
      });
    });

    // Procesar inspecciones
    inspecciones.forEach(inspeccion => {
      const horasRestantes = moment(inspeccion.fecha_programada).diff(moment(), 'hours');
      
      alertas.push({
        id: `inspeccion_${inspeccion.id}`,
        tipo: horasRestantes <= 1 ? 'error' : 'warning',
        titulo: `Inspección ${inspeccion.tipo_inspeccion} pendiente`,
        mensaje: `${inspeccion.complejo_nombre} - Unidad ${inspeccion.numero_unidad}`,
        tiempo: horasRestantes > 0 ? `${horasRestantes}h restantes` : 'Atrasada',
        categoria: 'operaciones'
      });
    });

    // Procesar check-ins próximos
    checkins.forEach(checkin => {
      const horasRestantes = moment(`${moment().format('YYYY-MM-DD')} ${checkin.hora_checkin}`).diff(moment(), 'hours');
      
      alertas.push({
        id: `checkin_${checkin.id}`,
        tipo: 'info',
        titulo: `Check-in programado`,
        mensaje: `${checkin.nombre} ${checkin.apellidos} - Unidad ${checkin.numero_unidad}`,
        tiempo: horasRestantes > 0 ? `En ${horasRestantes}h` : 'Ahora',
        categoria: 'operaciones'
      });
    });

    // Ordenar por prioridad
    const prioridadOrden = { error: 1, warning: 2, info: 3 };
    alertas.sort((a, b) => prioridadOrden[a.tipo] - prioridadOrden[b.tipo]);

    res.json({
      message: 'Alertas obtenidas exitosamente',
      data: alertas.slice(0, 10), // Máximo 10 alertas
      total: alertas.length
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/resumen-unidades - Resumen del estado de unidades
router.get('/resumen-unidades', async (req, res, next) => {
  try {
    const resumenQuery = `
      SELECT 
        c.id as complejo_id,
        c.nombre as complejo_nombre,
        COUNT(u.id) as total_unidades,
        SUM(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN u.estado = 'OCUPADA' THEN 1 ELSE 0 END) as ocupadas,
        SUM(CASE WHEN u.estado = 'MANTENIMIENTO' THEN 1 ELSE 0 END) as mantenimiento,
        SUM(CASE WHEN u.estado = 'FUERA_SERVICIO' THEN 1 ELSE 0 END) as fuera_servicio
      FROM complejos c
      LEFT JOIN unidades u ON c.id = u.complejo_id AND u.activo = TRUE
      WHERE c.activo = TRUE
      GROUP BY c.id, c.nombre
      ORDER BY c.nombre
    `;

    const resumen = await database.query(resumenQuery);

    const datos = resumen.map(item => ({
      ...item,
      porcentaje_ocupacion: item.total_unidades > 0 ? 
        ((item.ocupadas / item.total_unidades) * 100).toFixed(1) : 0
    }));

    res.json({
      message: 'Resumen de unidades obtenido exitosamente',
      data: datos
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/widget/:widget - Obtener datos de un widget específico
router.get('/widget/:widget', async (req, res, next) => {
  try {
    const { widget } = req.params;

    switch (widget) {
      case 'ocupacion':
        const ocupacion = await database.getDashboardStats();
        res.json({ data: ocupacion.ocupacion });
        break;

      case 'ingresos':
        const ingresos = await database.getDashboardStats();
        res.json({ data: ingresos.movimientos });
        break;

      case 'mantenimiento':
        const mantenimiento = await database.getDashboardStats();
        res.json({ data: mantenimiento.operaciones });
        break;

      default:
        res.status(404).json({
          error: 'Widget no encontrado',
          message: `El widget '${widget}' no existe`
        });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
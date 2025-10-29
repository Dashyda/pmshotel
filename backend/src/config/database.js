// Ejemplo: agregar getDashboardStats al módulo de configuración de BD.
// Ajusta a la forma concreta en que creas la conexión (mysql2, pg, etc).
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Devuelve un objeto con los datos que usan el dashboard.
 * Ajusta las consultas para cubrir exactamente lo que necesites en stats:
 * - movimientos (ingresos, egresos)
 * - ocupación (ocupadas, disponibles, mantenimiento)
 * - operaciones pendientes (inspecciones, tareas)
 * - otros widgets
 */
async function getDashboardStats() {
  // Ejemplos de consultas básicas; cámbialas por las tuyas
  const movimientosQuery = `
    SELECT 
      SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END) as ingresos,
      SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END) as egresos
    FROM movimientos
    WHERE DATE(fecha) = CURDATE()
  `;
  const ocupacionQuery = `
    SELECT 
      SUM(estado = 'CHECK_IN') AS ocupadas,
      SUM(estado = 'DISPONIBLE') AS disponibles,
      SUM(estado = 'MANTENIMIENTO') AS mantenimiento,
      COUNT(*) AS total_unidades
    FROM unidades
  `;
  const operacionesQuery = `
    SELECT COUNT(*) as pendientes FROM inspecciones WHERE estado = 'PENDIENTE'
  `;

  const [movimientos] = await Promise.all([
    query(movimientosQuery),
    query(ocupacionQuery),
    query(operacionesQuery)
  ]).then(results => results.map(r => Array.isArray(r) ? (r[0] || {}) : {}));

  // Normalizar salida para que coincida con lo que espera routes/dashboard.js
  return {
    movimientos: {
      ingresos: Number(movimientos[0]?.ingresos || 0),
      egresos: Number(movimientos[0]?.egresos || 0)
    },
    ocupacion: {
      ocupadas: Number(movimientos[1]?.ocupadas || 0),
      disponibles: Number(movimientos[1]?.disponibles || 0),
      mantenimiento: Number(movimientos[1]?.mantenimiento || 0),
      total_unidades: Number(movimientos[1]?.total_unidades || 0)
    },
    operaciones: {
      pendientes: Number(movimientos[2]?.pendientes || 0)
    }
  };
}

module.exports = {
  pool,
  query,
  queryOne,
  getDashboardStats
};

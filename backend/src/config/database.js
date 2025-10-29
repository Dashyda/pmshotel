// Módulo de DB compatible con Postgres (pg) y MySQL (mysql2)
// Detecta por DATABASE_URL / RAILWAY_* / DB_CLIENT
// Exporta: pool, query, queryOne, getDashboardStats
const debug = process.env.DEBUG_DB === 'true';
const clientHint = (process.env.DB_CLIENT || '').toLowerCase();

const usePg = Boolean(
  process.env.DATABASE_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  process.env.RAILWAY_POSTGRESQL_URL ||
  clientHint === 'pg' ||
  clientHint === 'postgres'
);

if (usePg) {
  // PostgreSQL (pg)
  const { Pool } = require('pg');

  function getPoolConfig() {
    const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || process.env.RAILWAY_POSTGRESQL_URL;
    if (dbUrl) {
      return { connectionString: dbUrl, ssl: { rejectUnauthorized: false } };
    }
    // Fallback to individual PG_* vars
    return {
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      user: process.env.DB_USER || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'pms_system',
      ssl: { rejectUnauthorized: false }
    };
  }

  const pool = new Pool(getPoolConfig());

  async function query(sql, params = []) {
    if (debug) console.log('[DB pg] QUERY:', sql, params);
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  // Implementación de getDashboardStats con sintaxis Postgres
  async function getDashboardStats() {
    // Movimientos del día (ingresos/egresos)
    const movimientosQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END),0)::numeric as ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END),0)::numeric as egresos
      FROM movimientos
      WHERE DATE(fecha) = CURRENT_DATE
    `;

    // Ocupación por estado
    const ocupacionQuery = `
      SELECT 
        COALESCE(SUM( (estado = 'CHECK_IN')::int ),0) AS ocupadas,
        COALESCE(SUM( (estado = 'DISPONIBLE')::int ),0) AS disponibles,
        COALESCE(SUM( (estado = 'MANTENIMIENTO')::int ),0) AS mantenimiento,
        COUNT(*) AS total_unidades
      FROM unidades
    `;

    // Operaciones pendientes (inspecciones)
    const operacionesQuery = `
      SELECT COUNT(*)::int as pendientes FROM inspecciones WHERE estado = 'PENDIENTE'
    `;

    // Ejecutar en paralelo
    const [movimientosRows, ocupacionRows, operacionesRows] = await Promise.all([
      query(movimientosQuery),
      query(ocupacionQuery),
      query(operacionesQuery)
    ]);

    const movimientos = movimientosRows && movimientosRows[0] ? movimientosRows[0] : { ingresos: 0, egresos: 0 };
    const ocupacion = ocupacionRows && ocupacionRows[0] ? ocupacionRows[0] : { ocupadas: 0, disponibles: 0, mantenimiento: 0, total_unidades: 0 };
    const operaciones = operacionesRows && operacionesRows[0] ? operacionesRows[0] : { pendientes: 0 };

    // Normalizar tipos a Number (evitar strings numéricas)
    return {
      movimientos: {
        ingresos: Number(movimientos.ingresos || 0),
        egresos: Number(movimientos.egresos || 0)
      },
      ocupacion: {
        ocupadas: Number(ocupacion.ocupadas || 0),
        disponibles: Number(ocupacion.disponibles || 0),
        mantenimiento: Number(ocupacion.mantenimiento || 0),
        total_unidades: Number(ocupacion.total_unidades || 0)
      },
      operaciones: {
        pendientes: Number(operaciones.pendientes || 0)
      }
    };
  }

  module.exports = {
    client: 'pg',
    pool,
    query,
    queryOne,
    getDashboardStats
  };

} else {
  // MySQL (mysql2/promise) - mantiene compatibilidad actual
  const mysql = require('mysql2/promise');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_NAME || 'pms_system',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
    queueLimit: 0
  });

  async function query(sql, params = []) {
    if (debug) console.log('[DB mysql] QUERY:', sql, params);
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  // Para MySQL mantenemos la versión anterior de getDashboardStats (ajustada)
  async function getDashboardStats() {
    const movimientosQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END),0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END),0) as egresos
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

    const [movimientosRows, ocupacionRows, operacionesRows] = await Promise.all([
      query(movimientosQuery),
      query(ocupacionQuery),
      query(operacionesQuery)
    ]);

    const movimientos = Array.isArray(movimientosRows) && movimientosRows[0] ? movimientosRows[0] : { ingresos: 0, egresos: 0 };
    const ocupacion = Array.isArray(ocupacionRows) && ocupacionRows[0] ? ocupacionRows[0] : { ocupadas: 0, disponibles: 0, mantenimiento: 0, total_unidades: 0 };
    const operaciones = Array.isArray(operacionesRows) && operacionesRows[0] ? operacionesRows[0] : { pendientes: 0 };

    return {
      movimientos: {
        ingresos: Number(movimientos.ingresos || 0),
        egresos: Number(movimientos.egresos || 0)
      },
      ocupacion: {
        ocupadas: Number(ocupacion.ocupadas || 0),
        disponibles: Number(ocupacion.disponibles || 0),
        mantenimiento: Number(ocupacion.mantenimiento || 0),
        total_unidades: Number(ocupacion.total_unidades || 0)
      },
      operaciones: {
        pendientes: Number(operaciones.pendientes || 0)
      }
    };
  }

  module.exports = {
    client: 'mysql',
    pool,
    query,
    queryOne,
    getDashboardStats
  };
}

const { Pool } = require('pg');
require('dotenv').config();

function getPoolConfigFromEnv() {
  // Prioridad:
  // 1) DATABASE_URL (usualmente privado dentro del proyecto Railway)
  // 2) DATABASE_PUBLIC_URL (proxy TCP público de Railway para conexiones externas)
  // 3) Variables individuales PG*
  const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || process.env.RAILWAY_POSTGRESQL_URL;
  const dbPublicUrl = process.env.DATABASE_PUBLIC_URL || process.env.RAILWAY_PUBLIC_DATABASE_URL;

  if (dbUrl) {
    return {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    };
  }

  if (dbPublicUrl) {
    return {
      connectionString: dbPublicUrl,
      ssl: { rejectUnauthorized: false }
    };
  }

  const host = process.env.DB_HOST || process.env.PGHOST || process.env.RAILWAY_PRIVATE_DOMAIN || 'localhost';
  const port = Number(process.env.DB_PORT || process.env.PGPORT || 5432);
  const user = process.env.DB_USER || process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || 'pms_system';

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  };
}

class Database {
  constructor() {
    this.pool = null;
    this.init();
  }

  async init() {
    try {
      const config = getPoolConfigFromEnv();
      console.log('🔎 Configuración PostgreSQL detectada:', {
        host: config.host || '(connectionString)',
        port: config.port || '(connectionString)',
        user: config.user || '(connectionString)',
        database: config.database || '(connectionString)'
      });

      this.pool = new Pool(config);

      // Probar la conexión
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Conexión a PostgreSQL establecida correctamente');
    } catch (error) {
      console.error('❌ Error conectando a PostgreSQL:', error.message);
      process.exit(1);
    }
  }

  async query(text, params = []) {
    try {
      const res = await this.pool.query(text, params);
      return res.rows;
    } catch (error) {
      console.error('Error en consulta SQL:', error);
      throw error;
    }
  }

  async queryOne(text, params = []) {
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Conexión a PostgreSQL cerrada');
    }
  }

  // Utilidades
  async findById(table, id, fields = '*') {
    const sql = `SELECT ${fields} FROM ${table} WHERE id = $1 AND activo = TRUE LIMIT 1`;
    return await this.queryOne(sql, [id]);
  }

  async findAll(table, conditions = {}, fields = '*', orderBy = 'id DESC', limit = null) {
    let sql = `SELECT ${fields} FROM ${table} WHERE activo = TRUE`;
    const params = [];
    let idx = 1;
    Object.keys(conditions).forEach(key => {
      sql += ` AND ${key} = $${idx++}`;
      params.push(conditions[key]);
    });
    sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    return await this.query(sql, params);
  }
}

module.exports = new Database();

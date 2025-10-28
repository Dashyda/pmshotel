const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
  constructor() {
    this.pool = null;
    this.init();
  }

  async init() {
    try {
  const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.RAILWAY_PRIVATE_DOMAIN || 'localhost';
  const rawPort = process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.MYSQL_TCP_PORT || '3306';
  const DB_PORT = Number.parseInt(rawPort, 10) || 3306;
      const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.MYSQLUSERNAME || 'root';
      const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
      const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'pms_system';

      this.pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4'
      });

      // Probar la conexión
      const connection = await this.pool.getConnection();
      console.log('✅ Conexión a MySQL establecida correctamente');
      connection.release();
    } catch (error) {
      console.error('❌ Error conectando a MySQL:', error.message);
      process.exit(1);
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Error en consulta SQL:', error);
      throw error;
    }
  }

  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const result = await callback(connection);
      await connection.commit();
      connection.release();
      return result;
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Conexión a MySQL cerrada');
    }
  }

  // Métodos de utilidad para consultas comunes
  async findById(table, id, fields = '*') {
    const sql = `SELECT ${fields} FROM ${table} WHERE id = ? AND activo = TRUE LIMIT 1`;
    return await this.queryOne(sql, [id]);
  }

  async findAll(table, conditions = {}, fields = '*', orderBy = 'id DESC', limit = null) {
    let sql = `SELECT ${fields} FROM ${table} WHERE activo = TRUE`;
    const params = [];

    // Agregar condiciones
    Object.keys(conditions).forEach(key => {
      sql += ` AND ${key} = ?`;
      params.push(conditions[key]);
    });

    sql += ` ORDER BY ${orderBy}`;
    
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    return await this.query(sql, params);
  }

  async create(table, data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
    const result = await this.query(sql, values);
    
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows
    };
  }

  async update(table, id, data) {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${table} SET ${fields} WHERE id = ?`;
    const result = await this.query(sql, values);
    
    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    };
  }

  async delete(table, id, softDelete = true) {
    if (softDelete) {
      const sql = `UPDATE ${table} SET activo = FALSE WHERE id = ?`;
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows };
    } else {
      const sql = `DELETE FROM ${table} WHERE id = ?`;
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows };
    }
  }

  // Métodos específicos para el PMS
  async getDashboardStats() {
    try {
      const stats = {};

      // Ocupación actual
      const ocupacionQuery = `
        SELECT 
          COUNT(u.id) as total_unidades,
          SUM(CASE WHEN u.estado = 'OCUPADA' THEN 1 ELSE 0 END) as unidades_ocupadas,
          SUM(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as unidades_disponibles,
          SUM(CASE WHEN u.estado = 'MANTENIMIENTO' THEN 1 ELSE 0 END) as unidades_mantenimiento
        FROM unidades u 
        WHERE u.activo = TRUE
      `;
      const ocupacion = await this.queryOne(ocupacionQuery);
      
      stats.ocupacion = {
        total: ocupacion.total_unidades || 0,
        ocupadas: ocupacion.unidades_ocupadas || 0,
        disponibles: ocupacion.unidades_disponibles || 0,
        mantenimiento: ocupacion.unidades_mantenimiento || 0,
        porcentaje: ocupacion.total_unidades > 0 ? 
          ((ocupacion.unidades_ocupadas / ocupacion.total_unidades) * 100).toFixed(1) : 0
      };

      // Movimientos del día
      const movimientosQuery = `
        SELECT 
          SUM(CASE WHEN r.fecha_checkin = CURDATE() AND r.estado IN ('CONFIRMADA', 'CHECK_IN') THEN 1 ELSE 0 END) as llegadas_hoy,
          SUM(CASE WHEN r.fecha_checkout = CURDATE() AND r.estado = 'CHECK_IN' THEN 1 ELSE 0 END) as salidas_hoy,
          SUM(CASE WHEN r.fecha_checkin = CURDATE() AND r.estado IN ('CONFIRMADA', 'CHECK_IN') THEN r.precio_total ELSE 0 END) as ingresos_hoy
        FROM reservas r
        WHERE r.fecha_checkin <= CURDATE() AND r.fecha_checkout >= CURDATE()
      `;
      const movimientos = await this.queryOne(movimientosQuery);
      
      stats.movimientos = {
        llegadas: movimientos.llegadas_hoy || 0,
        salidas: movimientos.salidas_hoy || 0,
        ingresos: parseFloat(movimientos.ingresos_hoy || 0)
      };

      // Novedades y mantenimiento
      const operacionesQuery = `
        SELECT 
          (SELECT COUNT(*) FROM novedades WHERE estado IN ('ABIERTA', 'EN_PROGRESO')) as novedades_abiertas,
          (SELECT COUNT(*) FROM inspecciones WHERE estado = 'PENDIENTE') as inspecciones_pendientes
      `;
      const operaciones = await this.queryOne(operacionesQuery);
      
      stats.operaciones = {
        novedades: operaciones.novedades_abiertas || 0,
        inspecciones: operaciones.inspecciones_pendientes || 0
      };

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas del dashboard:', error);
      throw error;
    }
  }

  async getOcupacionSemanal() {
    const query = `
      SELECT 
        DAYNAME(fecha) as dia_semana,
        WEEKDAY(fecha) as dia_numero,
        COUNT(DISTINCT unidad_id) as unidades_ocupadas,
        (SELECT COUNT(*) FROM unidades WHERE activo = TRUE) as total_unidades
      FROM historico_ocupacion 
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND fecha <= CURDATE()
        AND estado_ocupacion = 'OCUPADA'
      GROUP BY fecha, dia_semana, dia_numero
      ORDER BY dia_numero
    `;
    
    return await this.query(query);
  }

  async getIngresosMensuales() {
    const query = `
      SELECT 
        MONTH(fecha_checkin) as mes,
        YEAR(fecha_checkin) as año,
        SUM(precio_total) as ingresos_totales,
        COUNT(*) as total_reservas,
        AVG(precio_por_noche) as adr
      FROM reservas 
      WHERE fecha_checkin >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        AND estado NOT IN ('CANCELADA', 'NO_SHOW')
      GROUP BY año, mes
      ORDER BY año, mes
    `;
    
    return await this.query(query);
  }
}

// Singleton pattern para la base de datos
const database = new Database();

module.exports = database;
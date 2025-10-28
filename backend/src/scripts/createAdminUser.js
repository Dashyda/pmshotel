const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DEFAULT_ORGANIZATION = 'Organización Principal';
const DEFAULT_ROLE = 'Super Admin';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pms.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function ensureOrganization(connection) {
  const [rows] = await connection.query(
    'SELECT id FROM organizaciones WHERE nombre = ? LIMIT 1',
    [DEFAULT_ORGANIZATION]
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  const [result] = await connection.query(
    `INSERT INTO organizaciones (nombre, descripcion, email, activo)
     VALUES (?, 'Organización creada automáticamente', ?, TRUE)`,
    [DEFAULT_ORGANIZATION, ADMIN_EMAIL]
  );

  console.log(`🏢 Organización creada: ${DEFAULT_ORGANIZATION} (ID: ${result.insertId})`);
  return result.insertId;
}

async function ensureSuperAdminRole(connection) {
  const [rows] = await connection.query(
    'SELECT id FROM roles WHERE nivel_acceso = "SUPER_ADMIN" LIMIT 1'
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  const permisos = JSON.stringify(['*']);
  const [result] = await connection.query(
    `INSERT INTO roles (nombre, descripcion, permisos, nivel_acceso, activo)
     VALUES (?, 'Rol con acceso total creado automáticamente', ?, 'SUPER_ADMIN', TRUE)`,
    [DEFAULT_ROLE, permisos]
  );

  console.log(`🔐 Rol creado: ${DEFAULT_ROLE} (ID: ${result.insertId})`);
  return result.insertId;
}

async function upsertAdminUser(connection, organizationId, roleId) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const [existing] = await connection.query(
    'SELECT id FROM usuarios WHERE email = ? OR username = ? LIMIT 1',
    [ADMIN_EMAIL, ADMIN_USERNAME]
  );

  if (existing.length > 0) {
    await connection.query(
      `UPDATE usuarios
         SET password_hash = ?, rol_id = ?, organizacion_id = ?, activo = TRUE
       WHERE id = ?`,
      [passwordHash, roleId, organizationId, existing[0].id]
    );

    console.log(`✅ Usuario administrador actualizado (ID: ${existing[0].id})`);
    return existing[0].id;
  }

  const [result] = await connection.query(
    `INSERT INTO usuarios (
       organizacion_id,
       departamento_id,
       rol_id,
       username,
       email,
       password_hash,
       nombre,
       apellidos,
       telefono,
       activo
     ) VALUES (?, NULL, ?, ?, ?, ?, 'Administrador', 'Principal', NULL, TRUE)` ,
    [organizationId, roleId, ADMIN_USERNAME, ADMIN_EMAIL, passwordHash]
  );

  console.log(`✅ Usuario administrador creado (ID: ${result.insertId})`);
  return result.insertId;
}

async function createAdminUser() {
  console.log('🔐 Creando/actualizando usuario super administrador...');

  const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.RAILWAY_PRIVATE_DOMAIN || 'localhost';
  const rawPort = process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.MYSQL_TCP_PORT || '3306';
  const DB_PORT = Number.parseInt(rawPort, 10) || 3306;
  const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.MYSQLUSERNAME || 'root';
  const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
  const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'pms_system';

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true
  });

  try {
    await connection.beginTransaction();

    const organizationId = await ensureOrganization(connection);
    const roleId = await ensureSuperAdminRole(connection);
    const userId = await upsertAdminUser(connection, organizationId, roleId);

    await connection.commit();

    console.log('\n🎉 Listo. Puedes iniciar sesión con:');
    console.log(`   Usuario/Email: ${ADMIN_EMAIL}`);
    console.log(`   Usuario alternativo: ${ADMIN_USERNAME}`);
    console.log(`   Contraseña: ${ADMIN_PASSWORD}`);
    console.log(`   ID Usuario: ${userId}`);
    console.log('\n⚠️ Recuerda cambiar esta contraseña en producción.');
  } catch (error) {
    await connection.rollback();
    console.error('❌ No se pudo crear el usuario administrador:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DEFAULT_ROLE = process.env.DEFAULT_ROLE || 'SUPER_ADMIN';

// Crear pool con la misma detección que en config/database.js
function getPoolConfig() {
  const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || process.env.RAILWAY_POSTGRESQL_URL;
  if (dbUrl) {
    return { connectionString: dbUrl, ssl: { rejectUnauthorized: false } };
  }
  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const port = Number(process.env.DB_PORT || process.env.PGPORT || 5432);
  const user = process.env.DB_USER || process.env.PGUSER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
  const database = process.env.DB_NAME || process.env.PGDATABASE || 'pms_system';
  return { host, port, user, password, database, ssl: { rejectUnauthorized: false } };
}

const pool = new Pool(getPoolConfig());

async function ensureOrganization(client) {
  // Ejemplo: aseguramos una organización por defecto (ajusta a tu esquema real)
  const res = await client.query(
    `INSERT INTO organizaciones (nombre, activo)
     VALUES ($1, TRUE)
     ON CONFLICT (nombre) DO UPDATE SET activo = TRUE
     RETURNING id`,
    ['Organización Principal']
  );
  return res.rows[0].id;
}

async function ensureSuperAdminRole(client) {
  const permisos = JSON.stringify({ full: true });
  const resSelect = await client.query(
    'SELECT id FROM roles WHERE nombre = $1 LIMIT 1',
    [DEFAULT_ROLE]
  );
  if (resSelect.rows.length > 0) return resSelect.rows[0].id;

  const res = await client.query(
    `INSERT INTO roles (nombre, descripcion, permisos, codigo, activo)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id`,
    [DEFAULT_ROLE, 'Rol con acceso total creado automáticamente', permisos, 'SUPER_ADMIN']
  );
  return res.rows[0].id;
}

async function upsertAdminUser(client, organizationId, roleId) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const resExisting = await client.query(
    'SELECT id FROM usuarios WHERE email = $1 OR username = $2 LIMIT 1',
    [ADMIN_EMAIL, ADMIN_USERNAME]
  );

  if (resExisting.rows.length > 0) {
    const id = resExisting.rows[0].id;
    await client.query(
      `UPDATE usuarios
         SET password_hash = $1, rol_id = $2, organizacion_id = $3, activo = TRUE
       WHERE id = $4`,
      [passwordHash, roleId, organizationId, id]
    );
    console.log(`✅ Usuario administrador actualizado (ID: ${id})`);
    return id;
  }

  const res = await client.query(
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
     ) VALUES ($1, NULL, $2, $3, $4, $5, 'Administrador', 'Principal', NULL, TRUE)
     RETURNING id`,
    [organizationId, roleId, ADMIN_USERNAME, ADMIN_EMAIL, passwordHash]
  );

  console.log(`✅ Usuario administrador creado (ID: ${res.rows[0].id})`);
  return res.rows[0].id;
}

async function createAdminUser() {
  console.log('🔐 Creando/actualizando usuario super administrador...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const organizationId = await ensureOrganization(client);
    const roleId = await ensureSuperAdminRole(client);
    const userId = await upsertAdminUser(client, organizationId, roleId);

    await client.query('COMMIT');

    console.log('\n🎉 Listo. Puedes iniciar sesión con:');
    console.log(`   Usuario/Email: ${ADMIN_EMAIL}`);
    console.log(`   Usuario alternativo: ${ADMIN_USERNAME}`);
    console.log(`   Contraseña: ${ADMIN_PASSWORD}`);
    console.log(`   ID Usuario: ${userId}`);
    console.log('\n⚠️ Recuerda cambiar esta contraseña en producción.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ No se pudo crear el usuario administrador:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUser().catch(err => {
  console.error('Error script:', err);
  process.exit(1);
});

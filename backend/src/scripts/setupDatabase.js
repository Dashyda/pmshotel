const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('🔧 Configurando base de datos del PMS...');

  try {
    // Conectar sin especificar base de datos
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('✅ Conectado a MySQL');

    // Leer archivo de esquema
    const schemaPath = path.join(__dirname, '../../../database/schemas/pms_database_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Archivo de esquema no encontrado: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Ejecutando scripts de creación de base de datos...');
    
    // Ejecutar schema
    await connection.query(schema);
    
    console.log('✅ Base de datos creada exitosamente');
    console.log(`📊 Base de datos: ${process.env.DB_NAME || 'pms_system'}`);

    await connection.end();
    
    console.log('🎉 Configuración completada!');
    console.log('');
    console.log('Próximos pasos:');
    console.log('1. Ejecutar: npm run db:seed (para datos de ejemplo)');
    console.log('2. Ejecutar: npm run dev (para iniciar el servidor)');
    
  } catch (error) {
    console.error('❌ Error configurando la base de datos:', error.message);
    console.error('');
    console.error('Verifica:');
    console.error('1. MySQL está ejecutándose');
    console.error('2. Las credenciales en .env son correctas');
    console.error('3. El usuario tiene permisos para crear bases de datos');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
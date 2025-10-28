const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seedDatabase() {
  console.log('🧹 Limpiando datos del PMS...');

  try {
    // Conectar a la base de datos
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pms_system',
      multipleStatements: true
    });

    console.log('✅ Conectado a la base de datos');

    // Leer script de limpieza
    const seedPath = path.join(__dirname, '../../../database/scripts/insert_sample_data.sql');
    
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Archivo de datos no encontrado: ${seedPath}`);
    }

    const seedData = fs.readFileSync(seedPath, 'utf8');
    
    console.log('📄 Ejecutando script de limpieza...');

    // Ejecutar script de limpieza
    await connection.query(seedData);

    console.log('✅ Tablas limpiadas correctamente');

    const [summaryRows] = await connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) AS usuarios,
        (SELECT COUNT(*) FROM complejos) AS complejos,
        (SELECT COUNT(*) FROM unidades) AS unidades,
        (SELECT COUNT(*) FROM colaboradores) AS colaboradores,
        (SELECT COUNT(*) FROM reservas) AS reservas,
        (SELECT COUNT(*) FROM novedades) AS novedades,
        (SELECT COUNT(*) FROM inspecciones) AS inspecciones;
    `);

    const summary = Array.isArray(summaryRows) && summaryRows.length > 0 ? summaryRows[0] : {};

    console.log('📊 Resumen post-limpieza:');
    console.log(`   Usuarios: ${summary.usuarios ?? 0}`);
    console.log(`   Complejos: ${summary.complejos ?? 0}`);
    console.log(`   Unidades: ${summary.unidades ?? 0}`);
    console.log(`   Colaboradores: ${summary.colaboradores ?? 0}`);
    console.log(`   Reservas: ${summary.reservas ?? 0}`);
    console.log(`   Novedades: ${summary.novedades ?? 0}`);
    console.log(`   Inspecciones: ${summary.inspecciones ?? 0}`);

    if ((summary.usuarios ?? 0) === 0) {
      console.log('⚠️ No existen usuarios registrados. Crea tu primer administrador desde la aplicación o ejecuta tu propio script de inicialización.');
    }

    await connection.end();

    console.log('');
    console.log('🎉 Base de datos limpia y lista para datos reales.');
    console.log('');
    console.log('Próximos pasos sugeridos:');
    console.log('1. Inicia el backend: npm run dev');
    console.log('2. Crea tus organizaciones, complejos y unidades desde la interfaz.');
    
  } catch (error) {
    console.error('❌ Error limpiando datos:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
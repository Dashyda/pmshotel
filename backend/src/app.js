// Dentro de broadcastDashboardUpdate o donde llames database.getDashboardStats
const broadcastDashboardUpdate = async () => {
  try {
    if (!database || typeof database.getDashboardStats !== 'function') {
      console.error('broadcast: database.getDashboardStats no disponible', Object.keys(database || {}));
      return; // evitar excepción hasta arreglar el módulo de BD
    }
    const stats = await database.getDashboardStats();
    io.to('dashboard').emit('dashboard_update', {
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en broadcast de dashboard:', error);
  }
};

// Servicio para consumir la API externa de Railway
const axios = require('axios');

const API_BASE_URL = process.env.EXTERNAL_API_URL || 'https://pmshotel-production.up.railway.app';

const externalApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Ejemplo de función para consumir /health
async function getHealth() {
  const res = await externalApi.get('/health');
  return res.data;
}

// Puedes agregar más funciones para otros endpoints

module.exports = {
  getHealth,
  externalApi
};

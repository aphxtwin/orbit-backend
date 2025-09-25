// ✅ Crear: orbit/messaging-hub-backend/src/config/redis.js
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0
});

client.on('error', (err) => {
  console.error('❌ Redis Error:', err);
});

client.on('connect', () => {
  console.log('✅ Connected to Redis');
});

// Connect to Redis when the module is loaded
client.connect().catch(err => {
  console.error('❌ Failed to connect to Redis:', err);
});

module.exports = client;

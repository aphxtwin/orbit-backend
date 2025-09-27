// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');           // ⬅️ Servidor HTTP nativo
const { Server } = require('socket.io'); // ⬅️ socket.io
// Redis removed - using in-memory session storage



// Database connection here
const connectDB = require('./config/database');

// Api surface -> these are the routes that external systems can touch 
const conversationRoutes = require('./routes/conversationRoutes');
const userRoutes = require('./routes/userRoutes');
const webhookRoutes = require('./routes/webhook');
const searchRoutes = require('./routes/search');
const odooRoutes = require('./routes/odooRoutes');
const odooWebhookRoutes = require('./routes/odooWebhookRoutes');
const appUserRoutes = require('./routes/appUserRoute');
const ssoRoutes = require('./routes/ssoRoutes');
const oauthRoutes = require('./routes/oauthRoute');
const internalUserRoutes = require('./routes/internalUserRoutes');


const app = express();

// Conectar a MongoDB
connectDB();
// Redis removed - using in-memory session storage

const cors = require('cors');
const cookieParser = require('cookie-parser');

// Configurar CORS específicamente para permitir credentials
app.use(cors({
  origin: [
    process.env.FRONT_URL || 'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:8080',
    'https://orbit-five-teal.vercel.app',
    'https://*.bici-dev.com',
    // ✅ Agregar dominios de Cloudflare
    'https://*.trycloudflare.com',
    'https://*.ngrok.io',
    'https://*.ngrok-free.app'
  ], 
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'], // Permitir que el frontend lea las cookies
}));

app.use(cookieParser());
app.use(bodyParser.json());

const authMiddleware = require('./middleware/authMiddleware'); // ENABLED FOR AUTHENTICATION

// Rutas públicas (sin protección)
app.use('/webhook', webhookRoutes);

// Rutas de Odoo Webhook (PUBLIC)
app.use('/odoo-webhook', odooWebhookRoutes);

// Rutas de conversaciones (PROTECTED)
app.use('/conversations',  conversationRoutes);

// Rutas de usuarios (PROTECTED)
app.use('/users',  userRoutes);

app.use('/search',  searchRoutes);

// Ruta a odoo (PROTECTED)
app.use('/odoo',  odooRoutes);

// Rutas SSO (PUBLIC) - Should come FIRST
// app.use('/api/auth', ssoRoutes);

// // Rutas de AppUser (PROTECTED) - Should come SECOND
// app.use('/api/auth', appUserRoutes); Cambiar de '/sso' a '/api/auth'


// Rutas SSO (PUBLIC) - Should come FIRST
app.use('/auth', ssoRoutes);

// Rutas de AppUser (PROTECTED) - Should come SECOND
app.use('/user-auth', appUserRoutes); 

// Rutas OAuth (PROTECTED)
app.use('/oauth', oauthRoutes);

// Rutas de usuarios internos (PROTECTED)
app.use('/api/internal-users', internalUserRoutes);


//Ruta SSO (PUBLIC)
// const ssoRoutes = require('./routes/ssoRoutes');
// app.use('/sso', ssoRoutes);

// ───────────────────────────────────────────────────────────
// 1️⃣  Creás el servidor HTTP explícitamente
// ───────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// 2️⃣  Enganchás socket.io sobre ese servidor
const io = new Server(httpServer, {
  cors: { origin: '*' },      // Ajustá en producción
});

// 3️⃣  Hacés que cualquier route pueda acceder a io via req.app.get('io')
app.set('io', io);

// 4️⃣  Manejás conexiones WebSocket entrantes
io.on('connection', (socket) => {
  console.log('🔌 Cliente WS conectado:', socket.id);

  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectado:', socket.id, reason);
  });
});




const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () =>
  console.log(`HTTP + WebSocket server escuchando en :${PORT}`)
);

// Agregar la ruta de WhatsApp
const whatsappRoutes = require('./routes/whatsappRoutes');
app.use('/whatsapp', whatsappRoutes);

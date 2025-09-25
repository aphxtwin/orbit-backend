// ✅ Crear: orbit/messaging-hub-backend/src/service/sessionService.js
const redis = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

class SessionService {
  constructor() {
    this.SESSION_PREFIX = 'session:';
    this.SESSION_DURATION = 24 * 60 * 60; // 24 horas en segundos
  }

  async createSession(appUser, odooSessionData = null) {
    const sessionId = uuidv4();
    const sessionData = {
      sessionId,
      appUserId: appUser._id.toString(),
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      odooUserId: appUser.odooUserId,
      odooSessionData, // Datos de sesión de Odoo para reutilizar
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.SESSION_DURATION * 1000),
      lastActivity: Date.now()
    };

    await redis.setEx(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.SESSION_DURATION,
      JSON.stringify(sessionData)
    );

    return sessionId;
  }

  async getSession(sessionId) {
    const sessionData = await redis.get(`${this.SESSION_PREFIX}${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async updateLastActivity(sessionId) {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      await redis.setEx(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_DURATION,
        JSON.stringify(session)
      );
    }
  }

  async destroySession(sessionId) {
    await redis.del([`${this.SESSION_PREFIX}${sessionId}`]);
  }

  async destroyAllUserSessions(appUserId) {
    const pattern = `${this.SESSION_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    for (const key of keys) {
      const session = await redis.get(key);
      if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.appUserId === appUserId.toString()) {
          await redis.del([key]);
        }
      }
    }
  }
}

module.exports = new SessionService();

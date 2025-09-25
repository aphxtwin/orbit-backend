// ✅ In-memory session service (Redis removed)
const { v4: uuidv4 } = require('uuid');

class SessionService {
  constructor() {
    this.sessions = new Map(); // In-memory storage
    this.SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
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
      odooSessionData,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
      lastActivity: Date.now()
    };

    this.sessions.set(sessionId, sessionData);
    return sessionId;
  }

  async getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt > Date.now()) {
      return session;
    } else if (session) {
      this.sessions.delete(sessionId); // Clean up expired session
    }
    return null;
  }

  async updateLastActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.expiresAt = Date.now() + this.SESSION_DURATION;
      this.sessions.set(sessionId, session);
    }
  }

  async destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }

  async destroyAllUserSessions(appUserId) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.appUserId === appUserId.toString()) {
        this.sessions.delete(sessionId);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
    console.log(`✅ Session cleanup completed. Active sessions: ${this.sessions.size}`);
  }
}

module.exports = new SessionService();

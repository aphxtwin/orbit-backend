// ✅ Reemplazar: orbit/messaging-hub-backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { InternalUser, Tenant } = require('../models'); 

const ORBIT_JWT_SECRET = process.env.ORBIT_JWT_SECRET || 'ORBIT_SESSION_SECRET_KEY';

const authMiddleware = async (req, res, next) => {
  console.log('🔍 Auth Middleware - JWT-based');
  console.log(' URL:', req.url);
  console.log('🔍 Method:', req.method);
  
  // Obtener token del header Authorization
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    
    // ✅ LIMPIAR: Remover "Bearer " adicional si existe
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
      console.log('🔍 Token tenía "Bearer " adicional, limpiado');
    }
    
    console.log('🔍 Auth Middleware - Using Bearer token');
    console.log('🔍 Token length:', token.length);
    console.log('🔍 Token preview:', token.substring(0, 30) + '...');
    console.log(' Token ends with:', token.substring(token.length - 10));
  } else {
    console.log('🔍 Auth Middleware - No Bearer token found');
    console.log('🔍 Authorization header:', authHeader);
    console.log('🔍 All headers:', Object.keys(req.headers));
    return res.status(401).json({ 
      error: 'No autenticado - Bearer token required',
      code: 'NO_TOKEN' 
    });
  }

  try {
    // Verificar JWT token
    console.log('🔍 Verificando JWT con secret:', ORBIT_JWT_SECRET.substring(0, 15) + '...');
    console.log('🔍 Secret length:', ORBIT_JWT_SECRET.length);
    
    const payload = jwt.verify(token, ORBIT_JWT_SECRET);
    console.log('✅ JWT válido - Payload completo:', JSON.stringify(payload, null, 2));
    console.log('🔍 Payload keys:', Object.keys(payload));
    console.log('🔍 userId from payload:', payload.userId);
    console.log(' email from payload:', payload.email);
    
    // ✅ Validar que el payload contenga tenantRexUrl
    if (!payload.tenantRexUrl) {
      return res.status(401).json({ 
        error: 'Token inválido - falta información del tenant',
        code: 'MISSING_TENANT_INFO' 
      });
    }
    
    const appUser = await InternalUser.findById(payload.userId);
    if (!appUser) {
      console.log('❌ Auth Middleware - Usuario no encontrado en DB');
      console.log('❌ userId buscado:', payload.userId);
      console.log('❌ email del payload:', payload.email);
      return res.status(401).json({ 
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND' 
      });
    }
    
    console.log('✅ Usuario encontrado en DB:', {
      id: appUser._id,
      email: appUser.email,
      name: appUser.name,
      tenantId: appUser.tenantId
    });
    
    // ✅ Consultar el tenant después de validar usuario
    const tenant = await Tenant.findById(appUser.tenantId);
    
    if (!tenant) {
      console.error('❌ Auth Middleware - Tenant no encontrado en DB');
      console.error('❌ tenantId buscado:', appUser.tenantId);
      console.error('❌ userId:', appUser._id);
      return res.status(401).json({ 
        error: 'Tenant no encontrado',
        code: 'TENANT_NOT_FOUND' 
      });
    }
    
    // ✅ Validar que el tenant existe y está activo
    if (tenant.status !== 'active') {
      return res.status(403).json({ 
        error: 'Tenant inactivo',
        code: 'TENANT_INACTIVE' 
      });
    }
    
    // ✅ Validar coherencia entre JWT y base de datos
    if (tenant.rexUrl !== payload.tenantRexUrl) {
      return res.status(403).json({ 
        error: 'Inconsistencia en información del tenant',
        code: 'TENANT_URL_MISMATCH' 
      });
    }
    
    // ✅ Incluir req.tenantRexUrl en el request
    req.appUser = appUser;
    req.user = appUser;
    req.tenantId = appUser.tenantId;
    req.tenantName = tenant.name; // ✅ Usar nombre del tenant de la DB
    req.tenantRexUrl = tenant.rexUrl; // ✅ CAMBIO: Incluir tenantRexUrl del tenant de la DB
    req.odooUserId = payload.odooUserId;
    req.odooSessionId = payload.odooSessionId;
    
    // ✅ Mejorar logging para incluir información del tenant
    console.log('✅ Auth Middleware - JWT válido para:', appUser.email);
    console.log('✅ Auth Middleware - Tenant info:', {
      tenantId: tenant._id,
      tenantName: tenant.name,
      tenantRexUrl: tenant.rexUrl,
      tenantStatus: tenant.status
    });
    console.log('✅ Auth Middleware - User info:', {
      userId: appUser._id,
      userEmail: appUser.email,
      userName: appUser.name,
      odooUserId: payload.odooUserId
    });
    console.log('✅ Auth Middleware - Request configurado correctamente');
    
    next();
  } catch (err) {
    console.error('❌ Auth Middleware - Error verificando JWT:', err.message);
    console.error('❌ Error name:', err.name);
    console.error('❌ Error stack:', err.stack);
    
    // Dar detalles específicos según el tipo de error
    if (err.name === 'TokenExpiredError') {
      console.error('❌ Token expirado en:', err.expiredAt);
      return res.status(401).json({ 
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt
      });
    } else if (err.name === 'JsonWebTokenError') {
      console.error('❌ Error de formato del token:', err.message);
      return res.status(401).json({ 
        error: 'Token inválido',
        code: 'INVALID_TOKEN',
        details: err.message
      });
    } else if (err.name === 'NotBeforeError') {
      console.error('❌ Token usado antes de su fecha válida:', err.date);
      return res.status(401).json({ 
        error: 'Token usado antes de su fecha válida',
        code: 'TOKEN_NOT_ACTIVE',
        date: err.date
      });
    }
    
    return res.status(401).json({ 
      error: 'Token inválido o expirado',
      code: 'INVALID_TOKEN',
      details: err.message
    });
  }
};

module.exports = authMiddleware;
// ✅ Modificar: orbit/messaging-hub-backend/src/controllers/ssoControllers.js
const jwt = require('jsonwebtoken');
const { InternalUser } = require('../models');
const sessionService = require('../service/sessionService');
const tenantService = require('../service/tenantController');

const ODOO_JWT_SECRET = process.env.ODOO_JWT_SECRET || 'CAMBIA_ESTA_CLAVE_SUPER_SECRETA';

const ssoControllers = {
  async ssoCallback(req, res) {
    const token = req.query.token || req.query.session_id;
    
    if (!token) {
      console.log('❌ SSO Callback - Token no recibido');
      return res.status(400).json({ error: 'Falta token de SSO' });
    }

    try {
      const payload = jwt.verify(token, ODOO_JWT_SECRET);

      const odooSessionId = payload.session_id;
      if (!odooSessionId) return res.status(400).json({ error: 'No session_id en el token' });
      
      console.log('🔍 SSO: Payload from Odoo:', payload);
      
      // ✅ Validar que tenantRexUrl esté presente en el payload
      console.log('🔍 SSO: Extracting tenant info from JWT payload...');
      const rexUrl = payload.tenant_rex_url || process.env.REX_URL || 'http://localhost:8069';
      const tenantName = payload.tenant_name || 'Default Tenant';
      const database = payload.tenant_database || 'unknown';
      
      // ✅ Validación explícita de tenantRexUrl
      if (!payload.tenant_rex_url) {
        console.warn('⚠️ SSO: tenant_rex_url not found in payload, using fallback');
        console.warn('⚠️ SSO: This may indicate an issue with Odoo SSO configuration');
      }
      
      console.log(`🔍 SSO: Tenant info from Odoo - URL: ${rexUrl}, Name: ${tenantName}, DB: ${database}`);

      // 🔍 Step 2: Get or create tenant using tenant service
      const tenant = await tenantService.getOrCreateTenant(rexUrl, tenantName);
      console.log(`✅ SSO: Tenant resolved: ${tenant.name} (${tenant._id})`);
      
      // ✅ Validar que el tenant se creó/obtuvo correctamente
      if (!tenant || !tenant.rexUrl) {
        console.error('❌ SSO: Failed to resolve tenant with valid rexUrl');
        return res.status(500).json({ error: 'Error resolving tenant information' });
      }

      // 🔍 Step 3: Check if user exists within this tenant
      let appUser = await InternalUser.findOne({ 
        email: payload.email,
        tenantId: tenant._id.toString()
      });
      
      if (!appUser) {
        console.log('🆕 SSO: Creating new internal user...');
        // Create new user with tenant association
        appUser = await InternalUser.create({
          email: payload.email,
          name: payload.name,
          role: 'salesman',
          odooUserId: payload.user_id,
          tenantId: tenant._id.toString(), // Associate with tenant
          tenantRexUrl: tenant.rexUrl, // ✅ Store tenant rexUrl for fast reads
          type: 'InternalUser'
        });
        console.log(`✅ SSO: Created new user: ${appUser.name} (${appUser._id})`);
      } else {
        console.log(`✅ SSO: Found existing user: ${appUser.name} (${appUser._id})`);
        
        // Update user's odooUserId if it changed (for existing users)
        if (appUser.odooUserId !== payload.user_id) {
          console.log('�� SSO: Updating user odooUserId...');
          appUser.odooUserId = payload.user_id;
          await appUser.save();
          console.log(`✅ SSO: Updated user odooUserId: ${payload.user_id}`);
        }
        

      }

      // ✅ Asegurar que tenantRexUrl esté incluido en el JWT de sesión
      const ORBIT_JWT_SECRET = process.env.ORBIT_JWT_SECRET || 'ORBIT_SESSION_SECRET_KEY';
      const sessionToken = jwt.sign({
        userId: appUser._id,
        email: appUser.email,
        name: appUser.name,
        odooUserId: appUser.odooUserId,
        odooSessionId: odooSessionId,
        tenantId: tenant._id.toString(), // Include tenant ID in session
        tenantName: tenant.name, // Include tenant name for convenience
        tenantRexUrl: tenant.rexUrl, // ✅ CAMBIO: Asegurar que esté incluido
        tenantDatabase: database, // Include database info
      }, ORBIT_JWT_SECRET, { expiresIn: '24h' });

      // ✅ CAMBIO 6: Validar que el JWT de sesión se creó correctamente
      const decodedSessionToken = jwt.decode(sessionToken);
      if (!decodedSessionToken.tenantRexUrl) {
        console.error('❌ SSO: tenantRexUrl not included in session token');
        return res.status(500).json({ error: 'Error creating session token' });
      }

      console.log('✅ SSO: Authentication successful, returning session data');

      return res.json({
        message: 'Autenticación exitosa',
        token: sessionToken,
        user: {
          id: appUser._id,
          email: appUser.email,
          name: appUser.name,
          role: appUser.role,
          type: appUser.type,
          tenantId: tenant._id.toString(),
          tenantName: tenant.name
        },
        tenant: {
          id: tenant._id.toString(),
          name: tenant.name,
          rexUrl: tenant.rexUrl,
          status: tenant.status,
          database: database
        }
      });
    } catch (err) {
      console.error('❌ SSO: Error during authentication:', err);
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  },

  async logout(req, res) {
    const sessionId = req.cookies.orbitSessionId;
    if (sessionId) await sessionService.destroySession(sessionId);
    res.clearCookie('orbitSessionId');
    return res.json({ message: 'Sesión cerrada exitosamente' });
  },
};

module.exports = ssoControllers;

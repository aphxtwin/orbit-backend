// src/controllers/internalUserController.js
const appUserController = {
  async getMe(req, res) {
    try {
      if (!req.appUser) {
        return res.status(401).json({ error: 'Internal user not authenticated' });
      }
      const { _id, email, name, odooUserId, role, permissions, tenantRexUrl } = req.appUser;
      
      console.log('🔍 [DEBUG] AppUserController - user.tenantRexUrl:', tenantRexUrl);
      console.log('🔍 [DEBUG] AppUserController - req.tenantRexUrl:', req.tenantRexUrl);
      console.log('🔍 [DEBUG] AppUserController - req.tenantId:', req.tenantId);
      
      return res.json({ 
        id: _id, 
        email, 
        name, 
        odooUserId, 
        role, 
        permissions,
        tenantRexUrl: tenantRexUrl || req.tenantRexUrl // ✅ Prefer user.tenantRexUrl, fallback to req.tenantRexUrl
      });
    } catch (err) {
      console.error('getMe error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = appUserController;
const Message = require('../models/Message');

const searchController = {
  async searchMessages(req, res) {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Missing query' });
    }
    
    // Verificar que el usuario esté autenticado y tenga tenantId
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Tenant ID required for search' });
    }
    
    try {
      console.log(`🔍 Searching messages for tenant: ${req.tenantId}, query: "${q}"`);
      
      const results = await Message.find({ 
        content: { $regex: q, $options: 'i' },
        tenantId: req.tenantId  // ✅ Filtrar por tenant
      })
        .select('_id content conversation timestamp sender')
        .lean();
      
      console.log(`🔍 Found ${results.length} messages for tenant ${req.tenantId}`);
      res.json(results);
    } catch (error) {
      console.error('❌ Error in search:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = searchController; 
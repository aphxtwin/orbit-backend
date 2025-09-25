const Tenant = require('../models/Tenant');

class TenantService {
  /**
   * Get or create a tenant based on rexUrl
   * @param {string} rexUrl - The Odoo URL for the tenant
   * @param {string} name - Optional tenant name
   * @returns {Promise<Object>} The tenant object
   */
  async getOrCreateTenant(rexUrl, name = null) {
    try {
      console.log(`🔍 TenantService: Looking for tenant with rexUrl: ${rexUrl}`);
      
      // First, try to find existing tenant by rexUrl
      let tenant = await Tenant.findOne({ rexUrl });
      
      if (tenant) {
        console.log(`✅ TenantService: Found existing tenant: ${tenant.name} (${tenant._id})`);
        return tenant;
      }
      
      // If not found, create a new tenant
      console.log(`🆕 TenantService: Creating new tenant for rexUrl: ${rexUrl}`);
      
      const tenantName = name || this.generateTenantName(rexUrl);
      
      tenant = new Tenant({
        name: tenantName,
        rexUrl: rexUrl,
        status: 'active'
      });
      
      await tenant.save();
      console.log(`✅ TenantService: Created new tenant: ${tenant.name} (${tenant._id})`);
      
      return tenant;
    } catch (error) {
      console.error('❌ TenantService: Error in getOrCreateTenant:', error);
      throw error;
    }
  }
  
  /**
   * Get tenant by ID
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object|null>} The tenant object or null
   */
  async getTenantById(tenantId) {
    try {
      console.log(`🔍 TenantService: Looking for tenant by ID: ${tenantId}`);
      
      const tenant = await Tenant.findById(tenantId);
      
      if (tenant) {
        console.log(`✅ TenantService: Found tenant: ${tenant.name} (${tenant._id})`);
      } else {
        console.log(`❌ TenantService: Tenant not found: ${tenantId}`);
      }
      
      return tenant;
    } catch (error) {
      console.error('❌ TenantService: Error in getTenantById:', error);
      throw error;
    }
  }
  
  /**
   * Get tenant by rexUrl
   * @param {string} rexUrl - The Odoo URL for the tenant
   * @returns {Promise<Object|null>} The tenant object or null
   */
  async getTenantByRexUrl(rexUrl) {
    try {
      console.log(`🔍 TenantService: Looking for tenant by rexUrl: ${rexUrl}`);
      
      const tenant = await Tenant.findOne({ rexUrl });
      
      if (tenant) {
        console.log(`✅ TenantService: Found tenant: ${tenant.name} (${tenant._id})`);
      } else {
        console.log(`❌ TenantService: Tenant not found for rexUrl: ${rexUrl}`);
      }
      
      return tenant;
    } catch (error) {
      console.error('❌ TenantService: Error in getTenantByRexUrl:', error);
      throw error;
    }
  }
  
  /**
   * Generate a tenant name from rexUrl
   * @param {string} rexUrl - The Odoo URL
   * @returns {string} Generated tenant name
   */
  generateTenantName(rexUrl) {
    try {
      const url = new URL(rexUrl);
      const hostname = url.hostname;
      
      // Remove common prefixes and suffixes
      let name = hostname
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
        .replace(/\.ar$/, '')
        .replace(/\.dev$/, '')
        .replace(/\.local$/, '');
      
      // Capitalize first letter of each word
      name = name.split('.').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      return name || 'Default Tenant';
    } catch (error) {
      console.warn('⚠️ TenantService: Could not parse rexUrl, using default name:', error);
      return 'Default Tenant';
    }
  }
  
  /**
   * Get current tenant from request context
   * This should be called from middleware or controllers
   * @param {Object} req - Express request object
   * @returns {Promise<Object|null>} The tenant object or null
   */
  async getCurrentTenant(req) {
    try {
      // Try to get tenant from different sources
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      const rexUrl = req.headers['x-rex-url'] || req.body.rexUrl || req.query.rexUrl;
      
      if (tenantId) {
        return await this.getTenantById(tenantId);
      }
      
      if (rexUrl) {
        return await this.getOrCreateTenant(rexUrl);
      }
      
      console.log('⚠️ TenantService: No tenant identifier found in request');
      return null;
    } catch (error) {
      console.error('❌ TenantService: Error in getCurrentTenant:', error);
      throw error;
    }
  }
}

module.exports = new TenantService();
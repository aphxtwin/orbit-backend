const OAuth = require('../models/OAuth');
const axios = require('axios');

/**
 * Fetch WhatsApp message templates for a tenant
 */
async function getWhatsAppTemplates(req, res) {
  try {
    const tenantId = req.tenantId;

    console.log('[TEMPLATES] Fetching WhatsApp templates for tenant:', tenantId);

    // Find the WhatsApp OAuth configuration for this tenant
    const oauth = await OAuth.findOne({
      tenant: tenantId,
      channel: 'whatsapp',
      status: 'connected'
    });

    if (!oauth) {
      console.log('[TEMPLATES] WhatsApp not configured for tenant:', tenantId);
      return res.status(400).json({
        error: 'WhatsApp not configured for this tenant. Please complete setup first.'
      });
    }

    if (!oauth.businessId) {
      console.log('[TEMPLATES] Business ID not found for tenant:', tenantId);
      return res.status(400).json({
        error: 'WhatsApp Business Account not configured.'
      });
    }

    console.log('[TEMPLATES] Fetching from Business ID:', oauth.businessId);

    // Fetch templates from Meta Graph API
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${oauth.businessId}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
        },
        params: {
          fields: 'name,status,category,language,components',
          limit: 100
        }
      }
    );

    const templates = response.data.data || [];

    console.log('[TEMPLATES] Successfully fetched', templates.length, 'templates');

    res.json({
      success: true,
      templates: templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TEMPLATES] Error fetching templates:', error.message);

    if (error.response?.data?.error) {
      console.error('[TEMPLATES] Meta API Error:', error.response.data.error);
      return res.status(500).json({
        error: `Meta API Error: ${error.response.data.error.message}`,
        code: error.response.data.error.code
      });
    }

    res.status(500).json({
      error: 'Failed to fetch WhatsApp templates',
      details: error.message
    });
  }
}

module.exports = {
  getWhatsAppTemplates
};

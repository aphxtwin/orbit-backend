const OAuth = require('../models/OAuth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const axios = require('axios');
const { renderTemplate } = require('../utils/templateUtils');

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

    if (!oauth.wabaId) {
      console.log('[TEMPLATES] Business ID not found for tenant:', tenantId);
      return res.status(400).json({
        error: 'WhatsApp Business Account not configured.'
      });
    }

    console.log('[TEMPLATES] Fetching from Business ID:', oauth.wabaId);
    console.log('[TEMPLATES] Using access token:', oauth.accessToken?.substring(0, 20) + '...');
    console.log('[TEMPLATES] Request URL:', `https://graph.facebook.com/v22.0/${oauth.wabaId}/message_templates`);

    // Fetch templates from Meta Graph API
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${oauth.wabaId}/message_templates`,
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

    console.log('[TEMPLATES] Meta API Response Status:', response.status);
    console.log('[TEMPLATES] Meta API Response Data:', JSON.stringify(response.data, null, 2));

    const templates = response.data.data || [];

    console.log('[TEMPLATES] Successfully fetched', templates.length, 'templates');
    console.log('[TEMPLATES] Template names:', templates.map(t => t.name).join(', '));

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

/**
 * Send WhatsApp template message
 */
async function sendWhatsAppTemplate(req, res) {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?._id || req.appUser?._id;
    const { conversationId, to, templateName, language = 'en', variables = {} } = req.body;

    console.log('[SEND_TEMPLATE] Request:', { tenantId, userId, conversationId, to, templateName, language, variables });

    if (!userId) {
      console.error('[SEND_TEMPLATE] No user ID found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validations
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) is required' });
    }

    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Find the WhatsApp OAuth configuration
    const oauth = await OAuth.findOne({
      tenant: tenantId,
      channel: 'whatsapp',
      status: 'connected'
    });

    if (!oauth) {
      console.log('[SEND_TEMPLATE] WhatsApp not configured for tenant:', tenantId);
      return res.status(400).json({
        error: 'WhatsApp not configured for this tenant. Please complete setup first.'
      });
    }

    if (!oauth.phoneNumberId) {
      console.log('[SEND_TEMPLATE] Phone number ID not found for tenant:', tenantId);
      return res.status(400).json({
        error: 'WhatsApp phone number not configured.'
      });
    }

    console.log('[SEND_TEMPLATE] Using phone number ID:', oauth.phoneNumberId);
    console.log('[SEND_TEMPLATE] Using access token:', oauth.accessToken?.substring(0, 20) + '...');

    // Fetch the template to get its structure
    console.log('[SEND_TEMPLATE] Fetching template structure from Meta API...');
    const templateResponse = await axios.get(
      `https://graph.facebook.com/v22.0/${oauth.wabaId}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
        },
        params: {
          fields: 'id,name,status,category,language,components',
          name: templateName
        }
      }
    );

    const template = templateResponse.data.data?.find(
      t => t.name === templateName && t.language === language
    );

    if (!template) {
      console.log('[SEND_TEMPLATE] Template not found:', templateName, language);
      return res.status(404).json({ error: `Template '${templateName}' not found` });
    }

    console.log('[SEND_TEMPLATE] Template found:', template.id, template.name);

    // Render template content
    const { rawContent, renderedContent } = renderTemplate(template.components, variables);
    console.log('[SEND_TEMPLATE] Rendered content:', renderedContent);

    // Build template components with variables
    const components = [];

    // Check if template has variables and build parameters
    if (Object.keys(variables).length > 0) {
      const parameters = [];

      // Variables are indexed starting from 1
      const sortedIndices = Object.keys(variables)
        .map(k => parseInt(k))
        .sort((a, b) => a - b);

      for (const index of sortedIndices) {
        parameters.push({
          type: 'text',
          text: variables[index]
        });
      }

      components.push({
        type: 'body',
        parameters: parameters
      });

      console.log('[SEND_TEMPLATE] Template components:', JSON.stringify(components, null, 2));
    }

    // Build the message payload
    const messagePayload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language
        },
        ...(components.length > 0 && { components })
      }
    };

    console.log('[SEND_TEMPLATE] Message payload:', JSON.stringify(messagePayload, null, 2));

    // Send template via Meta API
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${oauth.phoneNumberId}/messages`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('[SEND_TEMPLATE] Meta API Response:', response.data);

    // Create message in database
    const newMessage = await Message.create({
      conversation: conversationId,
      sender: userId,
      tenantId: tenantId,
      content: rawContent,
      renderedContent: renderedContent,
      type: 'template',
      status: 'sent',
      direction: 'outbound',
      timestamp: new Date(),
      templateMetadata: {
        templateId: template.id,
        templateName: templateName,
        language: language,
        variables: variables,
        metaMessageId: response.data.messages?.[0]?.id
      }
    });

    console.log('[SEND_TEMPLATE] Message saved to database:', newMessage._id);

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date()
    });

    console.log('[SEND_TEMPLATE] Conversation updated');

    // No WebSocket emit - frontend handles via HTTP response

    res.json({
      success: true,
      message: newMessage,
      metaResponse: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[SEND_TEMPLATE] Error:', error.message);

    if (error.response?.data?.error) {
      console.error('[SEND_TEMPLATE] Meta API Error:', error.response.data.error);
      return res.status(500).json({
        error: `Meta API Error: ${error.response.data.error.message}`,
        code: error.response.data.error.code,
        details: error.response.data.error
      });
    }

    res.status(500).json({
      error: 'Failed to send WhatsApp template',
      details: error.message
    });
  }
}

module.exports = {
  getWhatsAppTemplates,
  sendWhatsAppTemplate
};

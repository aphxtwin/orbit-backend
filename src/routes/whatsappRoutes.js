const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { sendWhatsAppMessage } = require('../service/whatsapp');
const { getWhatsAppTemplates } = require('../controllers/whatsappController');

router.use(authMiddleware);

// POST /whatsapp/send-message
router.post('/send-message', async (req, res) => {
  try {
    const { to, message, type = 'text', template_name = 'hello_world' } = req.body;
    const tenantId = req.tenantId; // ✅ Del middleware de auth
    
    console.log('📤 WhatsApp send message request:', { 
      tenantId, 
      to, 
      message: message?.substring(0, 50) + '...', 
      type, 
      template_name 
    });
    
    // ✅ Validaciones básicas
    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) is required' });
    }
    
    if (!message && type === 'text') {
      return res.status(400).json({ error: 'Message text is required for text type' });
    }
    
    if (!template_name && type === 'template') {
      return res.status(400).json({ error: 'Template name is required for template type' });
    }
    
    // ✅ Llamar a la función del servicio de WhatsApp
    const result = await sendWhatsAppMessage(
      tenantId, 
      to, 
      message, 
      type, 
      template_name
    );
    
    console.log('✅ WhatsApp message sent successfully for tenant:', tenantId);
    
    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: result.data,
      phoneNumberId: result.phoneNumberId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.message);
    
    // ✅ Manejar errores específicos de WhatsApp
    if (error.message.includes('WhatsApp OAuth not found')) {
      return res.status(400).json({ 
        error: 'WhatsApp not configured for this tenant. Please complete setup first.' 
      });
    }
    
    if (error.message.includes('phone number not configured')) {
      return res.status(400).json({ 
        error: 'WhatsApp phone number not configured. Please complete phone setup first.' 
      });
    }
    
    // ✅ Errores de Meta API
    if (error.response?.data?.error) {
      return res.status(500).json({ 
        error: `Meta API Error: ${error.response.data.error.message}`,
        code: error.response.data.error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send WhatsApp message',
      details: error.message 
    });
  }
});

// GET /whatsapp/templates
router.get('/templates', getWhatsAppTemplates);

module.exports = router;
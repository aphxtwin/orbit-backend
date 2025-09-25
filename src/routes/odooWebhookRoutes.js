// routes/odooWebhookRoutes.js
const express = require('express');
const router = express.Router();

// ========================================
// WEBHOOK ENDPOINTS PARA ODOO 
// ========================================

// POST /api/webhooks/odoo/partner-updated
router.post('/partner-updated', async (req, res) => {
  console.log('🔔 Webhook Odoo - Partner Updated recibido');
  console.log('📥 Headers:', req.headers);
  console.log('📥 Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // 1. Validación de autenticación básica
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.ORBIT_WEBHOOK_SECRET;
    
    if (!expectedToken) {
      console.error('❌ ORBIT_WEBHOOK_SECRET no configurado en variables de entorno');
      return res.status(500).json({ 
        error: 'Webhook token not configured',
        message: 'Contacte al administrador del sistema'
      });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Header de autorización faltante o inválido');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Se requiere token de autorización Bearer'
      });
    }
    
    const token = authHeader.substring(7); // Remover "Bearer "
    if (token !== expectedToken) {
      console.error('❌ Token de autorización inválido');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token de autorización inválido'
      });
    }
    
    console.log('✅ Autenticación válida');
    
    // 2. Validación de datos
    const { partner_id, event_type, data } = req.body;
    
    if (!partner_id) {
      console.error('❌ partner_id faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'partner_id es requerido'
      });
    }
    
    if (!event_type) {
      console.error('❌ event_type faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'event_type es requerido'
      });
    }
    
    if (!data) {
      console.error('❌ data faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'data es requerido'
      });
    }
    
    console.log('✅ Validación de datos exitosa');
    console.log('📊 Datos del partner:', {
      partner_id,
      event_type,
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        orbit_user_id: data.orbit_user_id,
        orbit_sync_status: data.orbit_sync_status
      }
    });
    
    // 3. Procesar datos del webhook
    const { processOdooPartnerUpdate } = require('../controllers/odooWebhookController');
    
    try {
      const result = await processOdooPartnerUpdate(
        partner_id,
        event_type,
        data,
        data.tenant_info
      );
      
      console.log('✅ Webhook procesado exitosamente:', result);
      
      // 4. Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Webhook procesado exitosamente',
        partner_id,
        event_type,
        timestamp: new Date().toISOString(),
        result: result
      });
      
    } catch (processError) {
      console.error('❌ Error procesando webhook:', processError);
      res.status(500).json({
        success: false,
        error: 'Processing Error',
        message: processError.message,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error procesando webhook de Odoo:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error interno procesando el webhook',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhooks/odoo/lead-stage-updated
router.post('/lead-stage-updated', async (req, res) => {
  console.log('🔔 Webhook Odoo - Lead Stage Updated recibido');
  console.log('📥 Headers:', req.headers);
  console.log('📥 Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // 1. Validación de autenticación básica
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.ORBIT_WEBHOOK_SECRET;
    
    if (!expectedToken) {
      console.error('❌ ORBIT_WEBHOOK_SECRET no configurado en variables de entorno');
      return res.status(500).json({ 
        error: 'Webhook token not configured',
        message: 'Contacte al administrador del sistema'
      });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Header de autorización faltante o inválido');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Se requiere token de autorización Bearer'
      });
    }
    
    const token = authHeader.substring(7); // Remover "Bearer "
    if (token !== expectedToken) {
      console.error('❌ Token de autorización inválido');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token de autorización inválido'
      });
    }
    
    console.log('✅ Autenticación válida');
    
    // 2. Validación de datos específicos para leads
    const { lead_id, event_type, data } = req.body;
    
    if (!lead_id) {
      console.error('❌ lead_id faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'lead_id es requerido'
      });
    }
    
    if (!event_type) {
      console.error('❌ event_type faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'event_type es requerido'
      });
    }
    
    if (!data) {
      console.error('❌ data faltante en el payload');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'data es requerido'
      });
    }
    
    // 3. Validar que partner_id esté presente en los datos
    if (!data.partner_id) {
      console.error('❌ partner_id faltante en data');
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'partner_id es requerido en data'
      });
    }
    
    console.log('✅ Validación de datos exitosa');
    console.log('📊 Datos del lead:', {
      lead_id,
      event_type,
      partner_id: data.partner_id,
      stage_id: data.stage_id,
      stage_name: data.stage_name,
      user_id: data.user_id,  // ← AGREGAR user_id
      user_name: data.user_name,  // ← AGREGAR user_name
      partner_name: data.partner_name
    });
    
    // 4. Procesar datos del webhook usando la función existente
    const { processOdooPartnerUpdate } = require('../controllers/odooWebhookController');
    
    try {
      // Usar partner_id como parámetro principal para buscar el ClientUser
      const result = await processOdooPartnerUpdate(
        data.partner_id,  // ← Usar partner_id en lugar de lead_id
        event_type,
        data,
        data.tenant_info
      );
      
      console.log('✅ Webhook de lead procesado exitosamente:', result);
      
      // 5. Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Lead stage update procesado exitosamente',
        lead_id,
        partner_id: data.partner_id,
        event_type,
        timestamp: new Date().toISOString(),
        result: result
      });
      
    } catch (processError) {
      console.error('❌ Error procesando webhook de lead:', processError);
      res.status(500).json({
        success: false,
        error: 'Processing Error',
        message: processError.message,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error procesando webhook de lead de Odoo:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error interno procesando el webhook de lead',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /odoo-webhook/health - Endpoint de salud para verificar conectividad
router.get('/health', (req, res) => {
  console.log('🏥 Health check del webhook de Odoo');
  res.status(200).json({
    status: 'healthy',
    service: 'odoo-webhook',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'processing_enabled'
  });
});



module.exports = router;


// ============================================
// AI Routes
// ============================================
// Rutas para probar y usar el sistema de IA

const express = require('express');
const router = express.Router();
const aiService = require('../service/ai/aiService');

/**
 * POST /api/ai/test
 * Endpoint de prueba para enviar un mensaje a la IA
 *
 * Body:
 * {
 *   "message": "Hola, soy Juan Pérez y quiero una moto Honda"
 * }
 */
router.post('/test', async (req, res) => {
  try {
    const { message } = req.body;

    // Validación
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'El campo "message" es requerido',
      });
    }

    console.log('\n📨 Recibida solicitud de test de IA');
    console.log('Mensaje:', message);

    // Enviar a la IA
    const aiResponse = await aiService.sendMessage(message);

    // Responder
    res.json({
      success: true,
      data: {
        userMessage: message,
        aiResponse: aiResponse,
        provider: aiService.getConfig().provider,
        model: aiService.getConfig().model,
      },
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/test:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/extract
 * Extrae información específica de un texto
 *
 * Body:
 * {
 *   "text": "Hola, soy Juan Pérez y mi email es juan@gmail.com",
 *   "instruction": "extrae el nombre completo"
 * }
 */
router.post('/extract', async (req, res) => {
  try {
    const { text, instruction } = req.body;

    // Validación
    if (!text || !instruction) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "text" e "instruction" son requeridos',
      });
    }

    console.log('\n🔍 Recibida solicitud de extracción');
    console.log('Texto:', text);
    console.log('Instrucción:', instruction);

    // Extraer información
    const extracted = await aiService.extractInfo(text, instruction);

    // Responder
    res.json({
      success: true,
      data: {
        text: text,
        instruction: instruction,
        extracted: extracted,
      },
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/extract:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/analyze
 * Analiza un mensaje y devuelve un resumen
 *
 * Body:
 * {
 *   "message": "Hola, quiero comprar una Honda CRF 250 para ir al trabajo, mi presupuesto es de $5 millones"
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { message } = req.body;

    // Validación
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'El campo "message" es requerido',
      });
    }

    console.log('\n🔬 Recibida solicitud de análisis');
    console.log('Mensaje:', message);

    // Analizar mensaje
    const analysis = await aiService.analyzeMessage(message);

    // Responder
    res.json({
      success: true,
      data: {
        message: message,
        analysis: analysis,
      },
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/analyze:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/ai/health
 * Verifica el estado del servicio de IA
 */
router.get('/health', async (req, res) => {
  try {
    console.log('\n🏥 Verificando salud del servicio de IA...');

    const health = await aiService.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      ...health,
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/health:', error.message);

    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * GET /api/ai/config
 * Obtiene la configuración actual de IA (sin exponer API keys)
 */
router.get('/config', (req, res) => {
  try {
    const config = aiService.getConfig();

    res.json({
      success: true,
      config: config,
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/config:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/analyze-conversation/:conversationId
 * Analiza una conversación completa de la base de datos
 * Extrae datos de contacto y genera resumen
 *
 * Body:
 * {
 *   "tenantId": "tenant_123"
 * }
 */
router.post('/analyze-conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { tenantId } = req.body;

    // Validación
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "conversationId" es requerido',
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'El campo "tenantId" es requerido en el body',
      });
    }

    console.log(`\n🔍 Solicitud de análisis de conversación: ${conversationId}`);
    console.log(`🏢 Tenant: ${tenantId}`);

    // Analizar conversación
    const resultado = await aiService.analyzeConversation(conversationId, tenantId);

    // Responder
    res.json({
      success: true,
      data: resultado,
    });

  } catch (error) {
    console.error('❌ Error en /api/ai/analyze-conversation:', error.message);

    // Determinar código de error apropiado
    const statusCode = error.message.includes('no encontrada') ||
                       error.message.includes('no pertenece') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

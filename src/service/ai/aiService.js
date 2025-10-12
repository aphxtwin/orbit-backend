// ============================================
// AI Service - Interfaz Genérica
// ============================================
// Este es el servicio que tu código debe usar SIEMPRE
// No importa qué LLM uses (Groq, OpenAI, Claude),
// siempre llamas a las funciones de este archivo

const aiConfig = require('./config/aiConfig');
const groqProvider = require('./providers/groqProvider');

/**
 * Envía un mensaje al LLM y recibe una respuesta
 * Esta es la función principal que debes usar en tu código
 *
 * @param {string|Array<{role: string, content: string}>} promptOrMessages - Puede ser:
 *   - Un string simple (se envía como role: 'user')
 *   - Un array de mensajes con roles: [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
 * @param {object} options - Opciones adicionales (temperature, maxTokens, etc.)
 * @returns {Promise<string>} - La respuesta de la IA
 *
 * @example
 * // Uso simple
 * const response = await aiService.sendMessage('Extrae el nombre de: Hola soy Juan');
 * console.log(response); // "Juan"
 *
 * @example
 * // Uso con roles
 * const response = await aiService.sendMessage([
 *   { role: 'system', content: 'Eres un asistente de CRM' },
 *   { role: 'user', content: 'Analiza este mensaje...' }
 * ]);
 */
async function sendMessage(promptOrMessages, options = {}) {
  try {
    console.log(`\n🎯 AI Service - Provider activo: ${aiConfig.provider}`);

    // Validar que el parámetro no esté vacío
    if (!promptOrMessages) {
      throw new Error('El prompt o mensajes no pueden estar vacíos');
    }

    // Validar formato según el tipo
    if (typeof promptOrMessages === 'string') {
      if (promptOrMessages.trim().length === 0) {
        throw new Error('El prompt no puede estar vacío');
      }
    } else if (Array.isArray(promptOrMessages)) {
      if (promptOrMessages.length === 0) {
        throw new Error('El array de mensajes no puede estar vacío');
      }
    } else {
      throw new Error('El parámetro debe ser un string o un array de mensajes');
    }

    // Según el provider configurado, usar el correcto
    switch (aiConfig.provider) {
      case 'groq':
        return await groqProvider.send(promptOrMessages, options);

      case 'openai':
        // TODO: Implementar OpenAI provider en el futuro
        throw new Error('OpenAI provider aún no implementado. Usa "groq" por ahora.');

      case 'claude':
        // TODO: Implementar Claude provider en el futuro
        throw new Error('Claude provider aún no implementado. Usa "groq" por ahora.');

      default:
        throw new Error(
          `Provider '${aiConfig.provider}' no reconocido. ` +
          `Providers disponibles: groq, openai, claude`
        );
    }

  } catch (error) {
    console.error('❌ Error en AI Service:', error.message);
    throw error; // Re-lanzar el error para que el caller lo maneje
  }
}

/**
 * Extrae información específica de un texto usando IA
 * Optimizada con role: system para respuestas más consistentes
 *
 * @param {string} text - El texto del cual extraer información
 * @param {string} instruction - Qué extraer (ej: "extrae el nombre")
 * @returns {Promise<string|null>} - La información extraída o null si no se encuentra
 *
 * @example
 * const nombre = await aiService.extractInfo(
 *   'Hola, soy Juan Pérez y mi email es juan@gmail.com',
 *   'extrae solo el nombre completo'
 * );
 * console.log(nombre); // "Juan Pérez"
 */
async function extractInfo(text, instruction) {
  const messages = [
    {
      role: 'system',
      content: `Eres un asistente especializado en extraer información de conversaciones de WhatsApp/Instagram para un CRM de ventas de motocicletas.

REGLAS ESTRICTAS:
1. Responde SOLO con el dato solicitado, sin explicaciones ni contexto adicional
2. No agregues prefijos como "El nombre es:", "La respuesta es:", etc.
3. Si NO encuentras la información solicitada, responde exactamente: "NO_ENCONTRADO"
4. Mantén el formato original del dato (no lo modifiques)
5. Si hay múltiples opciones, elige la más relevante del CLIENTE (no del vendedor)`
    },
    {
      role: 'user',
      content: `${instruction}

Texto: "${text}"`
    }
  ];

  const result = await sendMessage(messages);

  // Si el AI responde "NO_ENCONTRADO", retornar null
  if (result && result.trim() === 'NO_ENCONTRADO') {
    return null;
  }

  return result ? result.trim() : null;
}

/**
 * Analiza un mensaje y devuelve un resumen estructurado
 * Optimizada con role: system para análisis enfocado en ventas
 *
 * @param {string} message - El mensaje a analizar
 * @returns {Promise<string>} - Análisis del mensaje
 *
 * @example
 * const analisis = await aiService.analyzeMessage(
 *   'Hola, quiero comprar una Honda CRF 250 para ir al trabajo'
 * );
 * console.log(analisis);
 * // "Producto: Honda CRF 250 para transporte laboral
 * // Interés: Alto, busca comprar
 * // Próximos pasos: Enviar información de precio y disponibilidad"
 */
async function analyzeMessage(message) {
  const messages = [
    {
      role: 'system',
      content: `Eres un analista de conversaciones para un CRM de ventas de motocicletas.

Tu tarea es analizar mensajes de clientes potenciales y generar resúmenes útiles para vendedores.

FORMATO DE RESPUESTA (2-3 líneas máximo):
- Primera línea: Qué producto/servicio busca el cliente
- Segunda línea: Nivel de interés y urgencia
- Tercera línea (opcional): Objeciones o requisitos especiales

ENFÓCATE EN:
- Producto de interés (modelo, tipo de moto)
- Uso previsto (delivery, trabajo, personal, recreación)
- Presupuesto mencionado
- Urgencia (cuándo necesita, si es inmediato)
- Objeciones o dudas principales
- Experiencia previa con motos

Sé conciso, directo y orientado a la acción de venta.`
    },
    {
      role: 'user',
      content: `Analiza este mensaje de cliente:

"${message}"`
    }
  ];

  return await sendMessage(messages);
}

/**
 * Verifica que el servicio de IA funcione correctamente
 * Útil para health checks y diagnósticos
 *
 * @returns {Promise<object>} - Estado del servicio
 */
async function healthCheck() {
  try {
    const startTime = Date.now();

    // Probar conexión según el provider activo
    let success = false;

    switch (aiConfig.provider) {
      case 'groq':
        success = await groqProvider.testConnection();
        break;

      default:
        throw new Error(`Provider ${aiConfig.provider} no soportado para health check`);
    }

    const duration = Date.now() - startTime;

    return {
      status: success ? 'healthy' : 'unhealthy',
      provider: aiConfig.provider,
      model: aiConfig[aiConfig.provider]?.model,
      responseTime: duration,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      provider: aiConfig.provider,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Obtiene información sobre la configuración actual de IA
 * @returns {object} - Configuración actual (sin exponer API keys)
 */
function getConfig() {
  const providerConfig = aiConfig[aiConfig.provider];

  return {
    provider: aiConfig.provider,
    model: providerConfig?.model,
    temperature: providerConfig?.temperature,
    maxTokens: providerConfig?.maxTokens,
    hasApiKey: !!providerConfig?.apiKey,
  };
}

/**
 * Analiza una conversación completa y extrae información relevante
 * Lee los mensajes de MongoDB, extrae datos de contacto y genera resumen
 *
 * @param {string} conversationId - ID de la conversación a analizar
 * @param {string} tenantId - ID del tenant (para seguridad multi-tenant)
 * @returns {Promise<object>} - Datos extraídos: {nombre, email, telefono, interes, resumen}
 *
 * @example
 * const resultado = await aiService.analyzeConversation(
 *   '507f1f77bcf86cd799439011',
 *   'tenant_123'
 * );
 * console.log(resultado.extractedData.nombre); // "Juan Pérez"
 */
async function analyzeConversation(conversationId, tenantId) {
  const Conversation = require('../../models/Conversation');
  const Message = require('../../models/Message');

  try {
    console.log(`\n🔍 Analizando conversación: ${conversationId} (Tenant: ${tenantId})`);

    // 1. Verificar que la conversación existe y pertenece al tenant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      tenantId: tenantId
    });

    if (!conversation) {
      throw new Error('Conversación no encontrada o no pertenece a este tenant');
    }

    console.log(`✅ Conversación encontrada - Platform: ${conversation.platform}`);

    // 2. Obtener TODOS los mensajes de esta conversación (filtrado por tenant)
    const messages = await Message.find({
      conversation: conversationId,
      tenantId: tenantId,
      type: 'text' // Solo mensajes de texto (ignorar imágenes, archivos)
    })
    .sort({ timestamp: 1 }) // Ordenar cronológicamente (más antiguo primero)
    .populate('sender', 'name userType') // Traer info del sender
    .lean(); // Mejor performance (devuelve objetos planos en vez de documentos Mongoose)

    if (messages.length === 0) {
      throw new Error('No hay mensajes de texto en esta conversación');
    }

    console.log(`📨 Encontrados ${messages.length} mensajes`);

    // 3. Formatear mensajes en texto legible para la IA
    const conversationText = messages.map(msg => {
      // Usar solo etiquetas genéricas (NO el name de DB)
      // Esto permite que la IA extraiga el nombre real de los mensajes
      const senderLabel = msg.sender.userType === 'ClientUser' ? 'Cliente' : 'Vendedor';

      return `${senderLabel}: ${msg.content}`;
    }).join('\n');

    console.log('📝 Conversación formateada para IA');
    console.log('Preview:', conversationText.substring(0, 200) + '...');

    // 4. Extraer datos de contacto en paralelo (más rápido que uno por uno)
    console.log('\n🤖 Extrayendo datos de contacto en paralelo...');

    const [nombre, email, telefono, interes] = await Promise.all([
      extractInfo(conversationText, 'extrae el nombre completo del cliente'),
      extractInfo(conversationText, 'extrae el email del cliente'),
      extractInfo(conversationText, 'extrae el número de teléfono del cliente'),
      extractInfo(conversationText, 'extrae qué producto o servicio busca el cliente (modelo de moto, tipo, uso previsto)')
    ]);

    // 5. Generar resumen de la conversación
    console.log('📊 Generando resumen de la conversación...');
    const resumen = await analyzeMessage(conversationText);

    // 6. Identificar el ClientUser de esta conversación
    console.log('\n💾 Buscando ClientUser para actualizar...');
    console.log('🔍 Participantes de la conversación:', conversation.participants);
    console.log('🔍 Platform:', conversation.platform);
    console.log('🔍 TenantId:', tenantId);

    const ClientUser = require('../../models/ClientUser');

    // Buscar específicamente ClientUser que esté en los participantes usando el discriminador
    const clientUser = await ClientUser.findOne({
      _id: { $in: conversation.participants },
      tenantId: tenantId,
      type: 'ClientUser' // Esto asegura que solo busque ClientUser
    });

    if (!clientUser) {
      console.log('⚠️  No se encontró ClientUser en esta conversación');
      
      // Debug: mostrar qué tipos de usuarios están en los participantes
      const User = require('../../models/UserBase').User;
      const allParticipants = await User.find({
        _id: { $in: conversation.participants },
        tenantId: tenantId
      }).select('_id name type');
      
      console.log('🔍 Tipos de participantes encontrados:', 
        allParticipants.map(p => ({ id: p._id, name: p.name, type: p.type }))
      );
    } else {
      console.log(`✅ ClientUser encontrado: ${clientUser._id}`);
      console.log('📋 Datos del ClientUser:', {
        id: clientUser._id,
        name: clientUser.name,
        email: clientUser.email,
        instagramId: clientUser.instagramId,
        whatsappPhoneNumber: clientUser.whatsappPhoneNumber,
        type: clientUser.type
      });

      // 7. Preparar datos para actualizar (solo los que existen)
      const updateData = {};

      if (nombre) {
        updateData.name = nombre;
        console.log(`  📝 Actualizando nombre: "${nombre}"`);
      }

      if (email) {
        updateData.email = email;
        console.log(`  📧 Actualizando email: "${email}"`);
      }

      if (telefono) {
        updateData.whatsappPhoneNumber = telefono;
        console.log(`  📱 Actualizando teléfono: "${telefono}"`);
      }

      if (resumen) {
        updateData.observations = resumen;
        console.log(`  📊 Actualizando observaciones con el resumen`);
      }

      // 8. Actualizar la base de datos
      if (Object.keys(updateData).length > 0) {
        await ClientUser.updateOne(
          { _id: clientUser._id },
          { $set: updateData }
        );
        console.log('✅ ClientUser actualizado en la base de datos');
      } else {
        console.log('ℹ️  No hay datos nuevos para actualizar');
      }
    }

    // 9. Retornar todo estructurado
    const resultado = {
      conversationId: conversationId,
      tenantId: tenantId,
      platform: conversation.platform,
      totalMessages: messages.length,
      extractedData: {
        nombre: nombre,
        email: email,
        telefono: telefono,
        interes: interes
      },
      resumen: resumen,
      conversationPreview: conversationText.substring(0, 300) + '...',
      updated: clientUser ? true : false,
      clientUserId: clientUser ? clientUser._id : null
    };

    console.log('✅ Análisis completado exitosamente');
    console.log('Datos extraídos:', resultado.extractedData);

    return resultado;

  } catch (error) {
    console.error('❌ Error analizando conversación:', error.message);
    throw error;
  }
}

module.exports = {
  sendMessage,
  extractInfo,
  analyzeMessage,
  analyzeConversation,
  healthCheck,
  getConfig,
};

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

module.exports = {
  sendMessage,
  extractInfo,
  analyzeMessage,
  healthCheck,
  getConfig,
};

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
 * @param {string} prompt - El mensaje/instrucción para la IA
 * @param {object} options - Opciones adicionales (temperature, maxTokens, etc.)
 * @returns {Promise<string>} - La respuesta de la IA
 *
 * @example
 * const aiService = require('./service/ai/aiService');
 * const response = await aiService.sendMessage('Extrae el nombre de: Hola soy Juan');
 * console.log(response); // "Juan"
 */
async function sendMessage(prompt, options = {}) {
  try {
    console.log(`\n🎯 AI Service - Provider activo: ${aiConfig.provider}`);

    // Validar que el prompt no esté vacío
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('El prompt no puede estar vacío');
    }

    // Según el provider configurado, usar el correcto
    switch (aiConfig.provider) {
      case 'groq':
        return await groqProvider.send(prompt, options);

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
 * Función de conveniencia para casos comunes
 *
 * @param {string} text - El texto del cual extraer información
 * @param {string} instruction - Qué extraer (ej: "extrae el nombre")
 * @returns {Promise<string>} - La información extraída
 *
 * @example
 * const nombre = await aiService.extractInfo(
 *   'Hola, soy Juan Pérez y mi email es juan@gmail.com',
 *   'extrae solo el nombre completo'
 * );
 * console.log(nombre); // "Juan Pérez"
 */
async function extractInfo(text, instruction) {
  const prompt = `${instruction}

Texto: "${text}"

Responde SOLO con la información solicitada, sin explicaciones adicionales.`;

  return await sendMessage(prompt);
}

/**
 * Analiza un mensaje y devuelve un resumen estructurado
 * Útil para entender de qué trata una conversación
 *
 * @param {string} message - El mensaje a analizar
 * @returns {Promise<string>} - Análisis del mensaje
 *
 * @example
 * const analisis = await aiService.analyzeMessage(
 *   'Hola, quiero comprar una Honda CRF 250 para ir al trabajo'
 * );
 * console.log(analisis);
 * // "Cliente interesado en Honda CRF 250, uso: transporte trabajo"
 */
async function analyzeMessage(message) {
  const prompt = `Analiza este mensaje de un cliente potencial y responde en 2-3 líneas qué quiere el cliente:

Mensaje: "${message}"

Análisis:`;

  return await sendMessage(prompt);
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

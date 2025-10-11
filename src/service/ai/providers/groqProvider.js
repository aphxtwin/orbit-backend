// ============================================
// Groq Provider
// ============================================
// Este archivo maneja la comunicación específica con Groq API

const Groq = require('groq-sdk');
const aiConfig = require('../config/aiConfig');

// Inicializar cliente de Groq
let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    const config = aiConfig.groq;

    if (!config.apiKey) {
      throw new Error('GROQ_API_KEY no está configurada en el archivo .env');
    }

    groqClient = new Groq({
      apiKey: config.apiKey,
    });

    console.log('🤖 Groq client inicializado');
  }

  return groqClient;
}

/**
 * Envía un mensaje a Groq y recibe una respuesta
 * @param {string} prompt - El mensaje/prompt a enviar
 * @param {object} options - Opciones adicionales (temperature, maxTokens, etc.)
 * @returns {Promise<string>} - La respuesta del LLM
 */
async function send(prompt, options = {}) {
  const startTime = Date.now();

  try {
    console.log('\n🚀 Enviando mensaje a Groq...');
    console.log('📝 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

    const client = getGroqClient();
    const config = aiConfig.groq;

    // Construir request
    const requestParams = {
      model: options.model || config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
    };

    // Llamar a la API de Groq
    const response = await client.chat.completions.create(requestParams);

    const aiResponse = response.choices[0].message.content;
    const duration = Date.now() - startTime;

    // Logging
    console.log('✅ Respuesta recibida de Groq');
    console.log(`⏱️  Duración: ${duration}ms`);
    console.log(`📊 Tokens usados: ${response.usage?.total_tokens || 'N/A'}`);
    console.log('💬 Respuesta:', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));

    // Log completo si está habilitado
    if (aiConfig.logCalls) {
      logAICall({
        provider: 'groq',
        model: requestParams.model,
        prompt,
        response: aiResponse,
        duration,
        tokens: response.usage,
      });
    }

    return aiResponse;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ Error en Groq Provider:');
    console.error(`⏱️  Duración hasta error: ${duration}ms`);
    console.error('Error:', error.message);

    // Manejo de errores específicos
    if (error.status === 401) {
      throw new Error('API Key de Groq inválida. Verifica GROQ_API_KEY en .env');
    }

    if (error.status === 429) {
      throw new Error('Rate limit excedido en Groq. Intenta de nuevo en unos segundos.');
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Timeout en la conexión con Groq. Intenta de nuevo.');
    }

    // Error genérico
    throw new Error(`Error en Groq: ${error.message}`);
  }
}

/**
 * Registra llamadas a la IA para debugging y análisis
 */
function logAICall(data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    provider: data.provider,
    model: data.model,
    promptLength: data.prompt.length,
    responseLength: data.response.length,
    duration: data.duration,
    tokens: data.tokens,
  };

  // Por ahora solo console.log, después se puede guardar en BD
  console.log('📋 AI Call Log:', JSON.stringify(logEntry, null, 2));
}

/**
 * Verifica que la conexión con Groq funcione
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    console.log('🧪 Testeando conexión con Groq...');
    const response = await send('Responde solo "OK" si puedes leer este mensaje.', {
      maxTokens: 10,
    });

    console.log('✅ Conexión con Groq exitosa');
    return true;
  } catch (error) {
    console.error('❌ Test de conexión falló:', error.message);
    return false;
  }
}

module.exports = {
  send,
  testConnection,
};

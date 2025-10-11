// ============================================
// AI Configuration
// ============================================
// Este archivo centraliza toda la configuración del sistema de IA
// Para cambiar de provider (Groq → OpenAI), solo cambia AI_PROVIDER en .env

require('dotenv').config();

const aiConfig = {
  // Provider activo: 'groq' | 'openai' | 'claude'
  provider: process.env.AI_PROVIDER || 'groq',

  // Configuración de Groq
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile', // Modelo recomendado para extracción de datos
    // Alternativas:
    // - 'llama-3.1-8b-instant' (más rápido, menos preciso)
    // - 'mixtral-8x7b-32768' (buen balance)
    maxTokens: 1000,
    temperature: 0.1, // Baja temperatura = más determinista (mejor para extracción de datos)
  },

  // Configuración de OpenAI (para futuro uso)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini', // Modelo económico y rápido
    maxTokens: 1000,
    temperature: 0.1,
  },

  // Configuración general
  timeout: 30000, // 30 segundos
  retries: 2, // Reintentos en caso de error

  // Logging
  logCalls: true, // Registrar todas las llamadas a la IA (útil para debugging)
};

// Validación: verificar que el provider configurado tenga API key
function validateConfig() {
  const provider = aiConfig.provider;
  const providerConfig = aiConfig[provider];

  if (!providerConfig) {
    throw new Error(`❌ Provider '${provider}' no está configurado en aiConfig.js`);
  }

  if (!providerConfig.apiKey) {
    throw new Error(
      `❌ API Key no configurada para provider '${provider}'\n` +
      `💡 Agrega ${provider.toUpperCase()}_API_KEY a tu archivo .env`
    );
  }

  console.log(`✅ AI Config válida - Provider: ${provider} | Model: ${providerConfig.model}`);
}

// Ejecutar validación al cargar el módulo
try {
  validateConfig();
} catch (error) {
  console.error(error.message);
  // No lanzar error en tiempo de carga, solo advertir
}

module.exports = aiConfig;

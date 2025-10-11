# 🤖 AI Service - Documentación

Este módulo gestiona toda la integración con Large Language Models (LLMs) de forma modular y fácil de cambiar.

## 📋 Índice

- [Configuración Inicial](#configuración-inicial)
- [Uso Básico](#uso-básico)
- [API Endpoints](#api-endpoints)
- [Cambiar de Provider](#cambiar-de-provider)
- [Estructura de Archivos](#estructura-de-archivos)

---

## ⚙️ Configuración Inicial

### 1. Obtener API Key de Groq

1. Ve a https://console.groq.com
2. Crea una cuenta (gratis, sin tarjeta de crédito)
3. Ve a "API Keys" en el menú
4. Haz clic en "Create API Key"
5. Copia la key (empieza con `gsk_...`)

### 2. Configurar Variables de Entorno

Edita tu archivo `.env` y agrega:

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_tu_api_key_aquí
```

### 3. Verificar Instalación

Inicia el servidor y verifica que no haya errores:

```bash
pnpm run dev
```

Deberías ver en la consola:
```
✅ AI Config válida - Provider: groq | Model: llama-3.1-70b-versatile
🤖 Groq client inicializado
```

---

## 💻 Uso Básico

### En tu código JavaScript

```javascript
const aiService = require('./service/ai/aiService');

// Enviar un mensaje simple
const response = await aiService.sendMessage(
  'Extrae el nombre de este mensaje: Hola, soy Juan Pérez'
);
console.log(response); // "Juan Pérez"

// Extraer información específica
const nombre = await aiService.extractInfo(
  'Hola, soy Juan Pérez y mi email es juan@gmail.com',
  'extrae solo el nombre completo'
);
console.log(nombre); // "Juan Pérez"

// Analizar un mensaje
const analisis = await aiService.analyzeMessage(
  'Quiero comprar una Honda CRF 250 para ir al trabajo'
);
console.log(analisis);
// "Cliente interesado en Honda CRF 250, uso: transporte trabajo"
```

---

## 🌐 API Endpoints

### 1. Test Básico

Envía un mensaje a la IA y recibe una respuesta.

```http
POST /api/ai/test
Content-Type: application/json

{
  "message": "Hola, soy Juan Pérez y quiero una moto Honda"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "userMessage": "Hola, soy Juan Pérez y quiero una moto Honda",
    "aiResponse": "Identifico que el cliente se llama Juan Pérez y está interesado en una motocicleta de marca Honda.",
    "provider": "groq",
    "model": "llama-3.1-70b-versatile"
  }
}
```

### 2. Extracción de Información

Extrae datos específicos de un texto.

```http
POST /api/ai/extract
Content-Type: application/json

{
  "text": "Hola, soy Juan Pérez, mi teléfono es +54911123456 y mi email es juan@gmail.com",
  "instruction": "extrae el nombre completo, teléfono y email en formato JSON"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "text": "Hola, soy Juan Pérez...",
    "instruction": "extrae el nombre completo...",
    "extracted": "{\"nombre\": \"Juan Pérez\", \"telefono\": \"+54911123456\", \"email\": \"juan@gmail.com\"}"
  }
}
```

### 3. Análisis de Mensaje

Analiza un mensaje y devuelve un resumen.

```http
POST /api/ai/analyze
Content-Type: application/json

{
  "message": "Hola, quiero comprar una Honda CRF 250 para ir al trabajo, mi presupuesto es de $5 millones"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "message": "Hola, quiero comprar una Honda CRF 250...",
    "analysis": "Cliente interesado en Honda CRF 250 para uso laboral. Presupuesto: $5M. Interés alto."
  }
}
```

### 4. Health Check

Verifica que el servicio de IA funcione.

```http
GET /api/ai/health
```

**Respuesta:**
```json
{
  "success": true,
  "status": "healthy",
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "responseTime": 1234,
  "timestamp": "2025-10-11T12:00:00.000Z"
}
```

### 5. Configuración Actual

Obtiene la configuración del servicio (sin exponer API keys).

```http
GET /api/ai/config
```

**Respuesta:**
```json
{
  "success": true,
  "config": {
    "provider": "groq",
    "model": "llama-3.1-70b-versatile",
    "temperature": 0.1,
    "maxTokens": 1000,
    "hasApiKey": true
  }
}
```

---

## 🔄 Cambiar de Provider

### De Groq a OpenAI

1. Obtén una API key de OpenAI: https://platform.openai.com/api-keys
2. Agrega a tu `.env`:
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-tu_api_key_aquí
   ```
3. Reinicia el servidor
4. ¡Listo! Todo tu código sigue funcionando igual

**Nota:** Actualmente solo Groq está implementado. OpenAI y Claude se agregarán en futuras fases.

---

## 📁 Estructura de Archivos

```
src/service/ai/
├── aiService.js              # ← TU CÓDIGO USA ESTE ARCHIVO
│   └── Interfaz genérica que tu código debe usar siempre
│
├── config/
│   └── aiConfig.js           # Configuración centralizada
│       └── Define qué provider usar y sus settings
│
├── providers/
│   ├── groqProvider.js       # Implementación específica de Groq
│   ├── openaiProvider.js     # (Futuro) Implementación de OpenAI
│   └── claudeProvider.js     # (Futuro) Implementación de Claude
│
└── README.md                 # Esta documentación
```

### Flujo de Ejecución

```
Tu código
   ↓
aiService.sendMessage()
   ↓
aiConfig (lee qué provider usar)
   ↓
groqProvider.send() ← Conexión con Groq API
   ↓
Respuesta de la IA
```

---

## 🧪 Probar la Integración

### Desde Postman

1. Importa esta colección de requests
2. Cambia la URL base a `http://localhost:8080`
3. Prueba cada endpoint

### Desde tu código

```javascript
// Ejemplo: Analizar un mensaje de WhatsApp
const aiService = require('./service/ai/aiService');

async function handleWhatsAppMessage(message) {
  try {
    // Extraer nombre del cliente
    const nombre = await aiService.extractInfo(
      message.content,
      'extrae solo el nombre completo del cliente'
    );

    console.log('Nombre extraído:', nombre);

    // Analizar intención del mensaje
    const analisis = await aiService.analyzeMessage(message.content);
    console.log('Análisis:', analisis);

  } catch (error) {
    console.error('Error al analizar mensaje:', error.message);
  }
}
```

---

## ❓ FAQ

### ¿Cuánto cuesta usar Groq?

Groq es **gratis** para desarrollo. Límites:
- 30 requests por minuto
- 14,400 requests por día

Más que suficiente para desarrollo y pruebas.

### ¿Qué hacer si veo "API Key inválida"?

1. Verifica que copiaste la key completa (empieza con `gsk_`)
2. Verifica que esté en tu `.env` como `GROQ_API_KEY=...`
3. Reinicia el servidor (`pnpm run dev`)

### ¿Qué hacer si veo "Rate limit excedido"?

Estás enviando demasiados requests muy rápido. Espera 1 minuto e intenta de nuevo.

### ¿Cómo sé si está funcionando?

Mira la consola del servidor. Deberías ver logs como:
```
🚀 Enviando mensaje a Groq...
✅ Respuesta recibida de Groq
⏱️  Duración: 1234ms
```

---

## 📚 Próximos Pasos

Una vez que tengas la conexión funcionando:

1. ✅ **Fase 2:** Extraer un solo dato (nombre) de conversaciones
2. ✅ **Fase 3:** Extraer múltiples datos (nombre, email, teléfono, etc.)
3. ✅ **Fase 4:** Leer historial conversacional completo
4. ✅ **Fase 5:** Actualizar Odoo automáticamente

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'groq-sdk'"

```bash
cd orbit-backend
pnpm install groq-sdk
```

### Error: "GROQ_API_KEY no está configurada"

Edita tu `.env` y agrega:
```env
GROQ_API_KEY=gsk_tu_api_key_aquí
```

### El servidor no inicia

Verifica que todas las dependencias estén instaladas:
```bash
cd orbit-backend
pnpm install
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en la consola
2. Verifica que tu `.env` esté configurado correctamente
3. Prueba el endpoint `/api/ai/health` para ver el estado del servicio

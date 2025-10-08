const mongoose = require('mongoose');

// Schema unificado para OAuth - configuración y conexión en un solo modelo

const oauthSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  channel: {
    type: String,
    enum: ['instagram', 'whatsapp', 'messenger'],
    required: true
  },
  // Estado de la conexión
  status: {
    type: String,
    enum: [
      'connected', 
      'disconnected', 
      'error', 
      'pending_page_selection'
    ],
    default: 'disconnected'
  },

  businessId: {
    type: String,
    trim: true
  },
  // Tokens de acceso (solo cuando está conectado)
  accessToken: {
    type: String,
    trim: true
  },
  longLivedToken: {
    type: String,
    trim: true
  },
  refreshToken: {
    type: String,
    trim: true
  },
  expiresAt: {
    type: Date,
  },
  // Metadatos de la conexión
  pageId: {
    type: String,
    trim: true
  },
  pageName: {
    type: String,
    trim: true
  },
  wabaId: {                 // ← ADD THIS
    type: String,
    trim: true
  },
  igUserId: { 
    type: String 
  },
  // WhatsApp específico
  waConfigId: {
    type: String,
    trim: true
  },
  phoneNumberId: {
    type: String,
    trim: true
  },
  phoneNumber: {  
    type: String,
    trim: true
  },
  // Información de la última conexión
  lastConnected: {
    type: Date
  },
  lastError: {
    message: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Índices
oauthSchema.index({ tenant: 1, channel: 1 }, { unique: true });
oauthSchema.index({ status: 1 });
oauthSchema.index({ 'facebook.appId': 1 });
oauthSchema.index({ igUserId: 1, channel: 1 });


// Métodos del modelo
oauthSchema.methods.isConnected = function() {
  return this.status === 'connected' && this.accessToken && !this.isExpired();
};



oauthSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

oauthSchema.methods.needsRefresh = function() {
  if (!this.expiresAt) return false;
  const refreshThreshold = new Date();
  refreshThreshold.setHours(refreshThreshold.getHours() + 24);
  return this.expiresAt < refreshThreshold;
};

// ✅ NUEVO: Método para obtener el token apropiado
oauthSchema.methods.getActiveToken = function() {
  // Priorizar long-lived token si existe
  if (this.longLivedToken) {
    return this.longLivedToken;
  }
  // Fallback al access token estándar
  return this.accessToken;
};

// ✅ NUEVO: Método para verificar si tiene long-lived token
oauthSchema.methods.hasLongLivedToken = function() {
  return !!this.longLivedToken;
};

oauthSchema.methods.updateConnection = function(connectionData) {
  // Permitir actualizar el status si se proporciona
  if (connectionData.status) {
    this.status = connectionData.status;
  } else {
    this.status = 'connected';
  }

  if (connectionData.wabaId) {
    this.wabaId = connectionData.wabaId;
  }
  
  // ✅ VALIDAR: Solo actualizar si el valor existe
  if (connectionData.accessToken) {
    this.accessToken = connectionData.accessToken;
  }
  
  if (connectionData.refreshToken) {
    this.refreshToken = connectionData.refreshToken;
  }
  
  if (connectionData.expiresAt) {
    this.expiresAt = connectionData.expiresAt;
  }
  
  if (connectionData.pageId) {
    this.pageId = connectionData.pageId;
  }
  
  if (connectionData.pageName) {
    this.pageName = connectionData.pageName;
  }
  
  if (connectionData.phoneNumberId) {
    this.phoneNumberId = connectionData.phoneNumberId;
  }
  
  if (connectionData.phoneNumber) {
    this.phoneNumber = connectionData.phoneNumber;
  }
  
  if (connectionData.igUserId) {
    this.igUserId = connectionData.igUserId;
  }
  
  // ✅ AGREGAR: Manejar businessId para WhatsApp
  if (connectionData.businessId) {
    this.businessId = connectionData.businessId;
  }

  if (connectionData.longLivedToken) {
    this.longLivedToken = connectionData.longLivedToken;
  }
  
  // Solo actualizar lastConnected si se está conectando completamente
  if (connectionData.status === 'connected') {
    this.lastConnected = new Date();
  }
  
  this.lastError = null;
  
  return this.save();
};

oauthSchema.methods.disconnect = function() {
  console.log(`🔄 Disconnecting OAuth for channel: ${this.channel}, tenant: ${this.tenant}`);

  // Siempre cambiar el status
  this.status = 'disconnected';

  // Solo limpiar campos que están definidos (no undefined)
  const fieldsToClean = [
    'accessToken', 'longLivedToken', 'refreshToken', 'expiresAt',
    'pageId', 'pageName', 'phoneNumberId', 'phoneNumber',
    'businessId', 'wabaId', 'igUserId'
  ];

  fieldsToClean.forEach(field => {
    if (this[field] !== undefined) {
      this[field] = null;
    }
  });

  console.log(`After disconnect - status: ${this.status}`);

  return this.save();
};

oauthSchema.methods.setError = function(error) {
  this.status = 'error';
  this.lastError = {
    message: error.message || error,
    timestamp: new Date()
  };
  
  return this.save();
};


// Crear el modelo
const OAuth = mongoose.model('OAuth', oauthSchema);

module.exports = OAuth; 
const mongoose = require('mongoose');
const { User } = require('./UserBase');

// Schema específico para usuarios clientes (contactos externos)
const clientUserSchema = new mongoose.Schema({
  instagramId: {
    type: String,
    trim: true,
    lowercase: true
  },
  tenantId: {
    type: String,
    required: true,
  },
  whatsappPhoneNumber: {
    type: String,
    trim: true,
    lowercase: true
  },
  messengerId: {
    type: String,
    trim: true,
    lowercase: true
  },
  crmStage: {
    type: String,
    trim: true,
  },
  // Información adicional del cliente
  assignedSalesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalUser'
  },
  notes: {
    type: String,
    trim: true
  },
  observations: {
    type: String,
    trim: true
  },
  // Historial de interacciones
  lastInteraction: {
    type: Date
  },
  
  // ✅ CAMPOS DE SINCRONIZACIÓN CON ODOO
  odooPartnerId: {
    type: String,
    trim: true
  },
  odooLeadId: {
    type: String,
    trim: true
  },
  syncStatus: {
    type: String,
    enum: ['not_synced', 'synced', 'error'],
    default: 'not_synced'
  },
  
  // ✅ HISTORIAL DE SINCRONIZACIÓN
  syncHistory: [{
    action: {
      type: String,
      enum: ['export', 'import', 'update', 'link'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    odooModel: {
      type: String,
      enum: ['res.partner', 'crm.lead'],
      required: true
    },
    odooId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['success', 'error'],
      required: true
    },
    fieldsUpdated: [{
      type: String,
      trim: true
    }],
    error: {
      type: String,
      trim: true
    }
  }]
  
}, {
  timestamps: true
});

// Índices específicos para usuarios clientes
clientUserSchema.index({ instagramId: 1 }, { 
  unique: true, 
  partialFilterExpression: { instagramId: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ whatsappPhoneNumber: 1 }, { 
  unique: true, 
  partialFilterExpression: { whatsappPhoneNumber: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ messengerId: 1 }, { 
  unique: true, 
  partialFilterExpression: { messengerId: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ crmStage: 1 });
clientUserSchema.index({ assignedSalesman: 1 });

// ✅ NUEVOS ÍNDICES PARA SINCRONIZACIÓN
clientUserSchema.index({ odooPartnerId: 1 });
clientUserSchema.index({ syncStatus: 1 });

// ✅ ÍNDICES OPTIMIZADOS PARA MULTI-TENANT
clientUserSchema.index({ tenantId: 1, instagramId: 1 }, { 
  unique: true, 
  partialFilterExpression: { instagramId: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ tenantId: 1, whatsappPhoneNumber: 1 }, { 
  unique: true, 
  partialFilterExpression: { whatsappPhoneNumber: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ tenantId: 1, messengerId: 1 }, { 
  unique: true, 
  partialFilterExpression: { messengerId: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ tenantId: 1, odooPartnerId: 1 }, { 
  unique: true, 
  partialFilterExpression: { odooPartnerId: { $exists: true, $ne: null } } 
});

clientUserSchema.index({ tenantId: 1, syncStatus: 1 });
clientUserSchema.index({ tenantId: 1, crmStage: 1 });
clientUserSchema.index({ tenantId: 1, assignedSalesman: 1 });

// ✅ VALIDACIÓN: odooPartnerId debe ser único POR TENANT
clientUserSchema.index({ tenantId: 1, odooPartnerId: 1 }, { 
  unique: true, 
  partialFilterExpression: { odooPartnerId: { $exists: true, $ne: null } } 
});

// Crear el discriminador
const ClientUser = User.discriminator('ClientUser', clientUserSchema);

module.exports = ClientUser;
const mongoose = require('mongoose');
const { User } = require('./UserBase');

// Schema específico para usuarios internos (empleados, administradores)
const internalUserSchema = new mongoose.Schema({
  odooUserId: {
    type: Number,
    required: false
  },
  tenantId: {
    type: String,
    required: true,
  },
  tenantRexUrl: {
    type: String,
    required: true,
    trim: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices específicos para usuarios internos
internalUserSchema.index({ odooUserId: 1 }, { 
  unique: true, 
  partialFilterExpression: { odooUserId: { $exists: true, $ne: null } } 
});

// Crear el discriminador
const InternalUser = User.discriminator('InternalUser', internalUserSchema);

module.exports = InternalUser;
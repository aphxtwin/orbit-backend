const mongoose = require('mongoose');

// Schema para representar diferentes organizaciones/tenants
const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  rexUrl: {
    type: String,
    required: true,
    trim: true
  },
  // Estado del tenant
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
}, {
  timestamps: true
});

// Índices para el modelo Tenant
tenantSchema.index({ status: 1 });

// Métodos del modelo
tenantSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Crear el modelo
const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = Tenant; 
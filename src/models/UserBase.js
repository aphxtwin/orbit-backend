const mongoose = require('mongoose');

// Base schema para todos los usuarios
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['admin', 'salesman', 'client', 'bot'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  type: {
    type: String,
    required: true,
    enum: ['InternalUser', 'ClientUser', 'AgentBot'],
  }
}, {
  timestamps: true,
  discriminatorKey: 'type'
});

// Índices para el modelo base
userSchema.index({ email: 1 }, { 
  unique: true, 
  partialFilterExpression: { email: { $exists: true, $ne: null } } 
});

// Crear el modelo base
const User = mongoose.model('User', userSchema);

// Exportar el modelo base y los discriminadores
module.exports = {
  User,
  userSchema
};
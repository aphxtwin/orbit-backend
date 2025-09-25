const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }],
  tenantId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['direct', 'group', 'bot'],
    default: 'direct'
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'instagram', 'messenger'],
    required: true,
    default: 'whatsapp'
  },
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  convVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

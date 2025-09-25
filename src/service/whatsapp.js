const { getUserOrCreate } = require('../controllers/userController');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();
const OAuth = require('../models/OAuth');

function parseWhatsAppWebhookPayload(rawPayload) {
  const entry = rawPayload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages?.[0];
  
  if (!messages) {
    console.log('🔄 No messages in WhatsApp payload');
    return null;
  }

  const senderId = messages.from;
  const messageText = messages.text?.body;
  const timestamp = messages.timestamp;
  const messageId = messages.id;

  console.log('📨 WhatsApp payload parsed:', { senderId, messageText, timestamp, messageId });

  if (!senderId || !messageText) {
    throw new Error('Missing sender ID or message text in WhatsApp payload');
  }

  // CHECK FOR ECHO MESSAGES - Skip them!
  if (messages.is_echo) {
    console.log('🔄 Skipping echo message');
    return null;
  }

  return {
    sender: senderId,
    content: messageText,
    timestamp: timestamp * 1000, // Convert to milliseconds
    messageId: messageId
  };
}

async function handleWhatsAppMessage(rawMsg, io, tenantId) {
  try {
    if (!tenantId) {
      throw new Error('❌ Could not determine tenant');
    }

    const parsedMsg = parseWhatsAppWebhookPayload(rawMsg);
    
    if (!parsedMsg) {
      console.log('🔄 Skipping message - no valid content');
      return { status: 200, skipped: true };
    }

    const user = await getUserOrCreate(parsedMsg.sender, null, null, 'whatsapp', tenantId);
    
    console.log('👤 WhatsApp user:', user);
    
    // Find conversation by tenant and external user ID
    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'whatsapp',
      participants: user._id
    });

    if (!conversation) {
      // Create conversation with just the external user (no internal user required)
      conversation = await Conversation.create({
        participants: [user._id], // Only the external user
        platform: 'whatsapp',
        tenantId: tenantId,
        type: 'direct'
      });
      console.log('💬 Created new WhatsApp conversation:', conversation._id);
    }

    const message = await Message.create({
      conversation: conversation._id,
      content: parsedMsg.content,
      sender: user._id,
      tenantId: user.tenantId,
      timestamp: new Date(parsedMsg.timestamp),
      type: 'text',
      status: 'sent',
      direction: 'inbound' // Webhook messages are always inbound
    });

    console.log('💬 WhatsApp message created:', message._id);

    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id
    });

    const conv = {
      id: message._id,
      content: message.content,
      sender: message.sender.toString(),
      tenantId: message.tenantId,
      timestamp: message.timestamp,
      platform: 'whatsapp',
      read: false,
      direction: 'inbound' // Always inbound for webhook messages
    };

    console.log('📡 Emitting WhatsApp event:', conv);
    io.emit('whatsapp:event', conv);

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('❌ handleWhatsAppMessage error:', error.message);
    return { status: 500, error: error.message };
  }
}

// ✅ Enviar mensaje de WhatsApp
async function sendWhatsAppMessage(tenantId, to, message, type = 'text', template_name = 'hello_world') {
  try {
    console.log('📤 Sending WhatsApp message:', { tenantId, to, message, type, template_name });
    
    // 1. Buscar OAuth del tenant para obtener phoneNumberId
    const oauth = await OAuth.findOne({ 
      tenant: tenantId, 
      channel: 'whatsapp',
      status: 'connected'
    });
    
    if (!oauth) {
      throw new Error('WhatsApp OAuth not found or not connected for this tenant');
    }
    
    if (!oauth.phoneNumberId) {
      throw new Error('WhatsApp phone number not configured for this tenant');
    }
    
    const phoneNumberId = oauth.phoneNumberId;
    console.log('✅ Using phone number ID from database:', phoneNumberId);
    
    // 2. Build payload exactly as Meta expects
    let payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: type
    };
    
    if (type === 'text') {
      payload.text = { 
        body: message 
      };
    } else if (type === 'template') {
      payload.template = {
        name: template_name,
        language: { 
          code: 'en_US' 
        }
      };
    }
    
    console.log(' WhatsApp payload (exact Meta format):', JSON.stringify(payload, null, 2));
    
    // 3. Enviar mensaje a Meta API
    const result = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`, // ✅ Usar token del tenant
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ WhatsApp message sent successfully:', result.data);
    
    return {
      success: true,
      data: result.data,
      message: 'WhatsApp message sent successfully',
      payload_sent: payload,
      phoneNumberId: phoneNumberId
    };
    
  } catch (error) {
    console.error('❌ WhatsApp send error:', error.response?.data || error.message);
    throw error;
  }
}

// ✅ EXPORTAR todas las funciones (modulares)
module.exports = { 
  handleWhatsAppMessage,           
  sendWhatsAppMessage              
};
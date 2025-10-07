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
    console.log('[WHATSAPP] No messages found - possibly status update');
    return null;
  }

  const senderId = messages.from;
  const messageText = messages.text?.body;
  const timestamp = messages.timestamp;
  const messageId = messages.id;

  if (!senderId || !messageText) {
    console.error('[WHATSAPP] Missing required fields: sender or message text');
    throw new Error('Missing sender ID or message text in WhatsApp payload');
  }

  // CHECK FOR ECHO MESSAGES - Skip them!
  if (messages.is_echo) {
    console.log('[WHATSAPP] Echo message detected - skipping');
    return null;
  }

  return {
    sender: senderId,
    content: messageText,
    timestamp: timestamp * 1000,
    messageId: messageId
  };
}

async function handleWhatsAppMessage(rawMsg, io, tenantId) {
  try {
    console.log('[WHATSAPP_RECEIVE] Message received for tenant:', tenantId);

    if (!tenantId) {
      console.error('[WHATSAPP_RECEIVE] No tenant ID provided');
      throw new Error('Could not determine tenant');
    }

    const parsedMsg = parseWhatsAppWebhookPayload(rawMsg);

    if (!parsedMsg) {
      console.log('[WHATSAPP_RECEIVE] Skipped - no valid message content');
      return { status: 200, skipped: true };
    }

    console.log('[WHATSAPP_RECEIVE] Processing message from:', parsedMsg.sender);

    const user = await getUserOrCreate(parsedMsg.sender, null, null, 'whatsapp', tenantId);

    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'whatsapp',
      participants: user._id
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [user._id],
        platform: 'whatsapp',
        tenantId: tenantId,
        type: 'direct'
      });
      console.log('[WHATSAPP_RECEIVE] New conversation created:', conversation._id);
    }

    const message = await Message.create({
      conversation: conversation._id,
      content: parsedMsg.content,
      sender: user._id,
      tenantId: user.tenantId,
      timestamp: new Date(parsedMsg.timestamp),
      type: 'text',
      status: 'sent',
      direction: 'inbound'
    });

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
      direction: 'inbound'
    };

    io.emit('whatsapp:event', conv);
    console.log('[WHATSAPP_RECEIVE] Message processed successfully');

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('[WHATSAPP_RECEIVE] Error:', error.message);
    return { status: 500, error: error.message };
  }
}

async function sendWhatsAppMessage(tenantId, to, message, type = 'text', template_name = 'hello_world') {
  try {
    console.log('[WHATSAPP_SEND] Sending message for tenant:', tenantId);

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

    console.log('[WHATSAPP_SEND] Payload:', JSON.stringify(payload));

    const result = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[WHATSAPP_SEND] Message sent successfully');

    return {
      success: true,
      data: result.data,
      message: 'WhatsApp message sent successfully',
      payload_sent: payload,
      phoneNumberId: phoneNumberId
    };

  } catch (error) {
    console.error('[WHATSAPP_SEND] Error:', error.response?.data || error.message);
    throw error;
  }
}

// ✅ EXPORTAR todas las funciones (modulares)
module.exports = { 
  handleWhatsAppMessage,           
  sendWhatsAppMessage              
};
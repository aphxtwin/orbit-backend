const { getUserOrCreate } = require('../controllers/userController');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();
const OAuth = require('../models/OAuth');

function parseWhatsAppWebhookPayload(rawPayload) {
  console.log('🔍 Parsing WhatsApp webhook payload...');
  console.log('📥 Full raw payload:', JSON.stringify(rawPayload, null, 2));

  const entry = rawPayload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages?.[0];

  console.log('🔍 Extracted structure:');
  console.log('   Entry ID:', entry?.id);
  console.log('   Changes field:', changes?.field);
  console.log('   Value metadata:', value?.metadata);
  console.log('   Messages array length:', value?.messages?.length || 0);

  if (!messages) {
    console.log('⚠️ No messages found in payload - possibly a status update or other webhook type');
    return null;
  }

  const senderId = messages.from;
  const messageText = messages.text?.body;
  const timestamp = messages.timestamp;
  const messageId = messages.id;
  const messageType = messages.type;

  console.log('📨 WhatsApp message details:');
  console.log('   Sender ID:', senderId);
  console.log('   Message text:', messageText);
  console.log('   Timestamp:', timestamp, '(', new Date(timestamp * 1000).toISOString(), ')');
  console.log('   Message ID:', messageId);
  console.log('   Message type:', messageType);
  console.log('   Is echo?:', messages.is_echo);

  if (!senderId || !messageText) {
    console.error('❌ Missing required fields: sender or message text');
    throw new Error('Missing sender ID or message text in WhatsApp payload');
  }

  // CHECK FOR ECHO MESSAGES - Skip them!
  if (messages.is_echo) {
    console.log('🔄 Echo message detected - skipping');
    return null;
  }

  console.log('✅ WhatsApp payload parsed successfully');
  return {
    sender: senderId,
    content: messageText,
    timestamp: timestamp * 1000, // Convert to milliseconds
    messageId: messageId
  };
}

async function handleWhatsAppMessage(rawMsg, io, tenantId) {
  try {
    console.log('\n========================================');
    console.log('🚀 WHATSAPP MESSAGE RECEIVED');
    console.log('========================================');
    console.log('🔐 Tenant ID:', tenantId);
    console.log('⏰ Timestamp:', new Date().toISOString());

    if (!tenantId) {
      console.error('❌ CRITICAL: No tenant ID provided');
      throw new Error('❌ Could not determine tenant');
    }

    const parsedMsg = parseWhatsAppWebhookPayload(rawMsg);

    if (!parsedMsg) {
      console.log('🔄 SKIPPED: No valid message content (possibly status update or echo)');
      console.log('========================================\n');
      return { status: 200, skipped: true };
    }

    console.log('\n--- User Management ---');
    console.log('🔍 Getting/creating user for sender:', parsedMsg.sender);
    const user = await getUserOrCreate(parsedMsg.sender, null, null, 'whatsapp', tenantId);
    console.log('✅ User ready - ID:', user._id, '| External ID:', user.externalUserId);
    console.log('   User details:', { name: user.name, phoneNumber: user.phoneNumber });

    console.log('\n--- Conversation Management ---');
    console.log('🔍 Searching for existing conversation...');
    console.log('   Platform: whatsapp');
    console.log('   Tenant:', tenantId);
    console.log('   Participant:', user._id);

    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'whatsapp',
      participants: user._id
    });

    if (!conversation) {
      console.log('📝 No existing conversation found - creating new one');
      conversation = await Conversation.create({
        participants: [user._id],
        platform: 'whatsapp',
        tenantId: tenantId,
        type: 'direct'
      });
      console.log('✅ New conversation created:', conversation._id);
    } else {
      console.log('✅ Found existing conversation:', conversation._id);
    }

    console.log('\n--- Message Creation ---');
    console.log('📝 Creating message in database...');
    console.log('   Content:', parsedMsg.content);
    console.log('   Sender:', user._id);
    console.log('   Conversation:', conversation._id);
    console.log('   Message ID (WhatsApp):', parsedMsg.messageId);

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
    console.log('✅ Message saved - ID:', message._id);

    console.log('\n--- Updating Conversation ---');
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id
    });
    console.log('✅ Conversation lastMessage updated');

    console.log('\n--- Socket Emission ---');
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
    console.log('📡 Emitting to socket.io event: whatsapp:event');
    console.log('📦 Event payload:', JSON.stringify(conv, null, 2));

    io.emit('whatsapp:event', conv);
    console.log('✅ Event emitted successfully');
    console.log('========================================\n');

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('\n❌❌❌ WHATSAPP ERROR ❌❌❌');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================\n');
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
const { getUserOrCreate } = require('../controllers/userController');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const OAuth = require('../models/OAuth');
const axios = require('axios');
require('dotenv').config();

/**
 * Parse Messenger webhook payload
 * @param {Object} rawPayload - Raw webhook payload from Facebook
 * @returns {Object|null} Parsed message data or null if echo/skip
 */
function parseMessengerWebhookPayload(rawPayload) {
  console.log('🔍 Parsing Messenger payload:', JSON.stringify(rawPayload, null, 2));
  
  const entry = rawPayload?.entry?.[0];
  const messaging = entry?.messaging?.[0];
  const senderId = messaging?.sender?.id;
  const messageText = messaging?.message?.text;
  const timestamp = messaging?.timestamp;
  
  console.log('🔍 Extracted data:', { senderId, messageText, timestamp });
  console.log('🔍 Full messaging object:', JSON.stringify(messaging, null, 2));
  
  if (!senderId || !messageText) {
    console.log('❌ Missing sender ID or message text');
    throw new Error('Missing sender ID or message text in Messenger payload');
  }
  
  // CHECK FOR ECHO MESSAGES - Skip them!
  console.log('🔍 Checking for echo message...');
  console.log('🔍 is_echo value:', messaging?.message?.is_echo);
  console.log('🔍 message object:', JSON.stringify(messaging?.message, null, 2));
  
  if (messaging?.message?.is_echo) {
    console.log('🔄 Skipping echo message');
    return null;
  }

  console.log('✅ Message is not an echo, proceeding...');
  return {
    sender: senderId,
    content: messageText,
    timestamp
  };
}

/**
 * Handle incoming Messenger message
 * @param {Object} rawMsg - Raw webhook message
 * @param {Object} io - Socket.io instance
 * @param {string} accessToken - Page access token
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Response status and data
 */
async function handleMessengerMessage(rawMsg, io, accessToken, tenantId) {
  try {
    console.log('🚀 Starting Messenger message handling...');
    console.log('🔍 tenantId:', tenantId);
    console.log('🔍 accessToken length:', accessToken?.length);
    
    if (!tenantId) {
      throw new Error('❌ Could not determine tenant from access token');
    }

    console.log('🔍 About to parse Messenger payload...');
    const parsedMsg = parseMessengerWebhookPayload(rawMsg);
    console.log('🔍 Parsed message result:', parsedMsg);
    
    if (!parsedMsg) {
      console.log('🔄 Skipping echo message - no parsed message');
      return { status: 200, message: 'Echo message skipped' };
    }
    
    console.log('✅ Message parsed successfully, getting/creating user...');
    // Get or create user
    const user = await getUserOrCreate(parsedMsg.sender, null, accessToken, 'messenger', tenantId);
    console.log('✅ User created/found:', user._id);
    
    // Find conversation by tenant and external user ID
    console.log('🔍 Looking for existing conversation...');
    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'messenger',
      participants: user._id
    });
    
    console.log('🔍 Conversation search result:', conversation?._id || 'Not found');

    if (!conversation) {
      console.log('🔍 Creating new conversation...');
      // Create conversation with just the external user (no internal user required)
      conversation = await Conversation.create({
        participants: [user._id], // Only the external user
        platform: 'messenger',
        tenantId: tenantId,
        type: 'direct'
      });
      console.log('✅ Created new conversation:', conversation._id);
    } else {
      console.log('✅ Found existing conversation:', conversation._id);
    }

    console.log('🔍 Creating message...');
    // Create message
    const message = await Message.create({
      conversation: conversation._id,
      content: parsedMsg.content,
      sender: user._id,
      tenantId: user.tenantId,
      timestamp: parsedMsg.timestamp || Date.now(),
      type: 'text',
      status: 'sent',
      direction: 'inbound' // Webhook messages are always inbound
    });
    console.log('✅ Message created:', message._id);

    // Update conversation's last message
    console.log('🔍 Updating conversation last message...');
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id
    });
    console.log('✅ Conversation updated');

    // Emit to frontend
    console.log('🔍 Emitting to frontend...');
    const conv = {
      id: message._id,
      content: message.content,
      sender: message.sender.toString(),
      tenantId: message.tenantId,
      timestamp: message.timestamp,
      platform: 'messenger',
      read: false,
      direction: 'inbound' // Always inbound for webhook messages
    };

    io.emit('messenger:event', conv);
    console.log('✅ Event emitted to frontend');

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('❌ handleMessengerMessage error:', error.message);
    console.error('❌ Full error:', error);
    return { status: 500, error: error.message };
  }
}

/**
 * Send message to Messenger
 * @param {string} tenantId - Tenant ID
 * @param {string} to - Recipient Messenger ID
 * @param {string} message - Message content
 * @param {string} type - Message type (default: 'text')
 * @returns {Object} Response data
 */
async function sendMessengerMessage(tenantId, to, message, type = 'text') {
  try {
    console.log('📤 Sending Messenger message:', { tenantId, to, message, type });
    
    // 1. Find OAuth record for this tenant
    const oauth = await OAuth.findOne({ 
      tenant: tenantId, 
      channel: 'messenger',
      status: 'connected'
    });
    
    if (!oauth) {
      throw new Error('Messenger OAuth not found or not connected for this tenant');
    }
    
    if (!oauth.accessToken) {
      throw new Error('Messenger access token not available for this tenant');
    }
    
    const accessToken = oauth.accessToken;
    console.log('✅ Using access token from database for tenant:', tenantId);
    
    // 2. Build payload for Messenger API
    let payload = {
      recipient: { id: to },
      message: {}
    };
    
    if (type === 'text') {
      payload.message.text = message;
    } else {
      // For other types, you can extend this
      payload.message.text = message;
    }
    
    console.log('📤 Messenger payload:', JSON.stringify(payload, null, 2));
    
    // 3. Send message to Messenger API
    const result = await axios.post(
      'https://graph.facebook.com/v20.0/me/messages',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Messenger message sent successfully:', result.data);
    
    return {
      success: true,
      data: result.data,
      message: 'Messenger message sent successfully',
      payload_sent: payload
    };
    
  } catch (error) {
    console.error('❌ Messenger send error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { 
  handleMessengerMessage,
  sendMessengerMessage
};
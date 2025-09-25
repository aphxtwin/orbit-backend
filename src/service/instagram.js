const { getUserOrCreate } = require('../controllers/userController');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message')
const OAuth = require('../models/OAuth');
const mongoose = require('mongoose');
require('dotenv').config()

/**
 * Get tenant ID from access token by finding the OAuth record
 * @param {string} accessToken - The access token to search for
 * @returns {Promise<string|null>} The tenant ID or null if not found
 */
async function getTenantFromAccessToken(accessToken) {
  try {
    const oauthRecord = await OAuth.findOne({ 
      accessToken: accessToken,
      channel: 'instagram',
      status: 'connected'
    });
    
    if (oauthRecord) {
      return oauthRecord.tenant.toString();
    }
    
    console.warn('⚠️ No OAuth record found for access token');
    return null;
  } catch (error) {
    console.error('❌ Error getting tenant from access token:', error);
    return null;
  }
}

function parseInstagramWebhookPayload(rawPayload) {
  console.log('🔍 Parsing Instagram payload:', JSON.stringify(rawPayload, null, 2));
  
  const entry = rawPayload?.entry?.[0];
  const messaging = entry?.messaging?.[0];
  const senderId = messaging?.sender?.id;
  const messageText = messaging?.message?.text;
  const timestamp = messaging?.timestamp;
  
  console.log('🔍 Extracted data:', { senderId, messageText, timestamp });
  console.log('🔍 Full messaging object:', JSON.stringify(messaging, null, 2));
  
  if (!senderId || !messageText) {
    console.log('❌ Missing sender ID or message text');
    throw new Error('Missing sender ID or message text in Instagram payload');
  }
  
  // CHECK FOR ECHO MESSAGES - Skip them!
  console.log('🔍 Checking for echo message...');
  console.log('🔍 is_echo value:', messaging?.message?.is_echo);
  console.log('🔍 message object:', JSON.stringify(messaging?.message, null, 2));
  
  // TEMPORARILY DISABLED FOR TESTING - Remove this comment and uncomment the next lines in production
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

async function handleInstagramMessage(rawMsg, io, accessToken, tenantId) {
  try {
    console.log('🚀 Starting Instagram message handling...');
    console.log('🔍 tenantId:', tenantId);
    console.log('🔍 accessToken length:', accessToken?.length);
    
    if (!tenantId) {
      throw new Error('❌ Could not determine tenant from access token');
    }

    console.log('🔍 About to parse Instagram payload...');
    const parsedMsg = parseInstagramWebhookPayload(rawMsg);
    console.log('🔍 Parsed message result:', parsedMsg);
    
    if (!parsedMsg) {
      console.log('🔄 Skipping echo message - no parsed message');
      return { status: 200, message: 'Echo message skipped' };
    }
    
    console.log('✅ Message parsed successfully, getting/creating user...');
    // Get or create user
    const user = await getUserOrCreate(parsedMsg.sender, null, accessToken, 'instagram', tenantId);
    console.log('✅ User created/found:', user._id);
    
    // Find conversation by tenant and external user ID
    console.log('🔍 Looking for existing conversation...');
    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'instagram',
      participants: user._id
    });
    
    console.log('🔍 Conversation search result:', conversation?._id || 'Not found');

    if (!conversation) {
      console.log('🔍 Creating new conversation...');
      // Create conversation with just the external user (no internal user required)
      conversation = await Conversation.create({
        participants: [user._id], // Only the external user
        platform: 'instagram',
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
      platform: 'instagram',
      read: false,
      direction: 'inbound' // Always inbound for webhook messages
    };

    io.emit('instagram:event', conv);
    console.log('✅ Event emitted to frontend');

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('❌ handleInstagramMessage error:', error.message);
    console.error('❌ Full error:', error);
    return { status: 500, error: error.message };
  }
}

module.exports = { handleInstagramMessage };

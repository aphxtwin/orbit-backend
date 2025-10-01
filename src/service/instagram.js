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
    console.log('\n========================================');
    console.log('🚀 INSTAGRAM MESSAGE RECEIVED');
    console.log('========================================');
    console.log('📥 Raw payload:', JSON.stringify(rawMsg, null, 2));
    console.log('🔐 Tenant ID:', tenantId);
    console.log('🔑 Access token length:', accessToken?.length);
    console.log('🔑 Access token preview:', accessToken ? `${accessToken.substring(0, 15)}...` : 'MISSING');
    console.log('⏰ Timestamp:', new Date().toISOString());

    if (!tenantId) {
      console.error('❌ CRITICAL: No tenant ID provided');
      throw new Error('❌ Could not determine tenant from access token');
    }

    console.log('\n--- Parsing Instagram Payload ---');
    const parsedMsg = parseInstagramWebhookPayload(rawMsg);
    console.log('✅ Parsed message:', JSON.stringify(parsedMsg, null, 2));
    
    if (!parsedMsg) {
      console.log('🔄 SKIPPED: Echo message detected');
      console.log('========================================\n');
      return { status: 200, message: 'Echo message skipped' };
    }

    console.log('\n--- User Management ---');
    console.log('🔍 Getting/creating user for sender:', parsedMsg.sender);
    const user = await getUserOrCreate(parsedMsg.sender, null, accessToken, 'instagram', tenantId);
    console.log('✅ User ready - ID:', user._id, '| External ID:', user.externalUserId);

    console.log('\n--- Conversation Management ---');
    console.log('🔍 Searching for existing conversation...');
    console.log('   Platform: instagram');
    console.log('   Tenant:', tenantId);
    console.log('   Participant:', user._id);

    let conversation = await Conversation.findOne({
      tenantId: tenantId,
      platform: 'instagram',
      participants: user._id
    });

    if (!conversation) {
      console.log('📝 No existing conversation found - creating new one');
      conversation = await Conversation.create({
        participants: [user._id],
        platform: 'instagram',
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

    const message = await Message.create({
      conversation: conversation._id,
      content: parsedMsg.content,
      sender: user._id,
      tenantId: user.tenantId,
      timestamp: parsedMsg.timestamp || Date.now(),
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
      platform: 'instagram',
      read: false,
      direction: 'inbound'
    };
    console.log('📡 Emitting to socket.io event: instagram:event');
    console.log('📦 Event payload:', JSON.stringify(conv, null, 2));

    io.emit('instagram:event', conv);
    console.log('✅ Event emitted successfully');
    console.log('========================================\n');

    return { status: 200, conversationId: conversation._id };
  } catch (error) {
    console.error('\n❌❌❌ INSTAGRAM ERROR ❌❌❌');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================\n');
    return { status: 500, error: error.message };
  }
}

module.exports = { handleInstagramMessage };

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
  console.log('\n┌──────────────────────────────────────────────────────┐');
  console.log('│      PARSING INSTAGRAM WEBHOOK PAYLOAD               │');
  console.log('└──────────────────────────────────────────────────────┘');
  console.log('📥 [INSTAGRAM_RECEIVE] Full raw payload:', JSON.stringify(rawPayload, null, 2));

  const entry = rawPayload?.entry?.[0];
  const messaging = entry?.messaging?.[0];
  const senderId = messaging?.sender?.id;
  const messageText = messaging?.message?.text;
  const timestamp = messaging?.timestamp;
  const messageId = messaging?.message?.mid;

  console.log('📊 [INSTAGRAM_RECEIVE] Extracted payload structure:');
  console.log('   ├─ Entry ID:', entry?.id);
  console.log('   ├─ Sender ID:', senderId);
  console.log('   ├─ Recipient ID:', messaging?.recipient?.id);
  console.log('   ├─ Message ID (mid):', messageId);
  console.log('   ├─ Message text:', messageText);
  console.log('   ├─ Timestamp:', timestamp, timestamp ? `(${new Date(timestamp).toISOString()})` : '');
  console.log('   └─ is_echo:', messaging?.message?.is_echo);

  console.log('🔍 [INSTAGRAM_RECEIVE] Full messaging object:', JSON.stringify(messaging, null, 2));

  if (!senderId || !messageText) {
    console.error('❌ [INSTAGRAM_RECEIVE] Validation failed - missing required fields');
    console.error('   ├─ Sender ID present:', !!senderId);
    console.error('   └─ Message text present:', !!messageText);
    throw new Error('Missing sender ID or message text in Instagram payload');
  }

  // CHECK FOR ECHO MESSAGES - Skip them!
  console.log('🔍 [INSTAGRAM_RECEIVE] Echo message check:');
  console.log('   └─ is_echo value:', messaging?.message?.is_echo);

  if (messaging?.message?.is_echo) {
    console.log('🔄 [INSTAGRAM_RECEIVE] Echo message detected - SKIPPING');
    return null;
  }

  console.log('✅ [INSTAGRAM_RECEIVE] Payload validation successful - not an echo message');
  console.log('📦 [INSTAGRAM_RECEIVE] Parsed message data:');
  console.log('   ├─ Sender:', senderId);
  console.log('   ├─ Content:', messageText?.substring(0, 100) + (messageText?.length > 100 ? '...' : ''));
  console.log('   ├─ Message ID:', messageId);
  console.log('   └─ Timestamp:', timestamp);

  return {
    sender: senderId,
    content: messageText,
    timestamp,
    messageId
  };
}

async function handleInstagramMessage(rawMsg, io, accessToken, tenantId) {
  try {
    console.log('\n========================================');
    console.log('🚀 INSTAGRAM MESSAGE RECEIVED');
    console.log('========================================');
    console.log('[INSTAGRAM_RECEIVE] Webhook hit at:', new Date().toISOString());
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
      console.log('[INSTAGRAM_RECEIVE] 🔄 SKIPPED: Echo message detected');
      console.log('========================================\n');
      return { status: 200, message: 'Echo message skipped' };
    }

    console.log('[INSTAGRAM_RECEIVE] Processing inbound message from:', parsedMsg.sender);

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
    console.log('[INSTAGRAM_RECEIVE] ✅ Message processed and saved successfully');
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

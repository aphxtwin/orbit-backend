const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const OAuth = require('../models/OAuth'); // Add OAuth import
const axios = require('axios'); // Add axios import
const { ClientUser } = require('../models');
const { sendMessengerMessage } = require('../service/messenger.js');


const conversationController = {
  async create(req, res) {
    try {
      const { participants, type } = req.body;
      const conversation = await Conversation.create({
        participants,
        tenantId: req.tenantId,
        type
      });
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMessages(req, res) {
    try {
      console.log('🔍 Incoming request for getMessages:', {
        params: req.params,
        query: req.query,
        url: req.url,
        method: req.method,

        headers: req.headers,
        body: req.body
      });

      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        console.log('Conversation not found');
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const etag = `${conversation.convVersion}-${conversation.lastMessage}`;
      console.log('🔍 ETag:', etag);

      if (req.headers['if-none-match'] === etag) {
        console.log('🔍 ETag match, returning 304');
        return res.status(304).end();
      }

      const messages = await Message.find({ conversation: conversationId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select({
          _id: 1,
          content: 1,
          sender: 1,
          timestamp:1,
          createdAt: 1,
          direction: 1,
          status: 1,
          type: 1
        })
        .lean()
        .exec();
      
      res.setHeader('If-None-Match', etag);
      console.log('🔍 ETag set:', etag);
      res.json(messages.reverse());
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: error.message });
    }
  },


  
  async getUserConversations(req, res) {
    try {
      // Use authenticated user from middleware instead of URL parameter
      const authenticatedUser = req.appUser;
      const tenantId = authenticatedUser.tenantId;

      console.log('🔍 Fetching conversations for user:', authenticatedUser._id);
      console.log('🔍 Tenant ID:', tenantId);

      // Fetch conversations for this tenant (all conversations in the tenant)
      const [whatsappConversations, instagramConversations, messengerConversations] = await Promise.all([
        Conversation.find({
          tenantId: tenantId,
          status: 'active',
          platform: 'whatsapp'
        })
        .select('_id participants platform type lastMessage status tenantId')
        .lean(),
        
        Conversation.find({
          tenantId: tenantId,
          status: 'active',
          platform: 'instagram'
        })
        .select('_id participants platform type lastMessage status tenantId')
        .lean(),
        
        Conversation.find({
          tenantId: tenantId,
          status: 'active',
          platform: 'messenger'
        })
        .select('_id participants platform type lastMessage status tenantId')
        .lean()
      ]);

      console.log('WhatsApp conversations for tenant:', whatsappConversations.length);
      console.log('Instagram conversations for tenant:', instagramConversations.length);
      console.log('Messenger conversations for tenant:', messengerConversations.length);

      const allConversations = [...whatsappConversations, ...instagramConversations, ...messengerConversations];
      
      allConversations.forEach(conv => {
        if (!Array.isArray(conv.participants)) {
          console.warn(`Warning: participants is not an array for conversation ${conv._id}`);
        }
      });

      res.json(allConversations);
      
    } catch (error) {
      console.error('Error in getUserConversations:', error);
      res.status(500).json({ error: error.message });
    }
  },

    async sendMessage(req, res) {
    try {
      const authenticatedUser = req.appUser;
      const tenantId = authenticatedUser.tenantId;
      const { conversationId } = req.params;
      const { sender, content, type, timestamp } = req.body;

      console.log('Sending message with data:', { conversationId, sender, content, type, tenantId });

      // Get the conversation to determine the platform
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get OAuth record for the platform
      let oauthRecord = await OAuth.findOne({ 
        tenant: tenantId,
        channel: conversation.platform,
        status: 'connected'
      });

      if (!oauthRecord) {
        console.error(`No connected ${conversation.platform} OAuth found for tenant:`, tenantId);
        return res.status(404).json({ 
          error: `No connected ${conversation.platform} account found. Please connect your ${conversation.platform} account first.` 
        });
      }



      // Create the message in the database with pending status
      const message = await Message.create({
        conversation: conversationId,
        tenantId: tenantId,
        sender: sender,
        content,
        timestamp,
        type,
        direction: 'outbound',
        status: 'pending'
      });

      console.log('Created message:', message);

      // Update the conversation's last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        convVersion: conversation.convVersion + 1
      });

      // Send the message to the external platform
      try {
        if (conversation.platform === 'instagram') {
          console.log('[INSTAGRAM_SEND] 📤 Sending message to Instagram at:', new Date().toISOString());
          console.log('Sending message to Instagram');
          console.log('🔍 OAuth Record:', {
            tenant: oauthRecord.tenant,
            channel: oauthRecord.channel,
            status: oauthRecord.status,
            accessTokenLength: oauthRecord.accessToken?.length,
            accessTokenPreview: oauthRecord.accessToken?.substring(0, 20) + '...'
          });
          
          // Get the recipient (other participant in the conversation)
          const otherParticipant = conversation.participants.find(p => p.toString() !== sender);
          if (!otherParticipant) {
            throw new Error('No recipient found in conversation');
          }

          // Get the user to find their Instagram ID
          
          const recipientUser = await ClientUser.findById(otherParticipant);
          if (!recipientUser || !recipientUser.instagramId) {
            throw new Error('Recipient user not found or has no Instagram ID');
          }

          console.log('🔍 Recipient User:', {
            _id: recipientUser._id,
            instagramId: recipientUser.instagramId,
            name: recipientUser.name
          });

          // Send to Instagram using the correct API endpoint
          const requestPayload = {
            recipient: { id: recipientUser.instagramId },
            message: { text: content }
          };
          
          console.log('🔍 Instagram API Request:', {
            url: 'https://graph.facebook.com/v20.0/me/messages',
            payload: requestPayload,
            headers: {
              Authorization: `Bearer ${oauthRecord.accessToken.substring(0, 20)}...`,
              'Content-Type': 'application/json'
            }
          });

          // Test the access token first
          try {
            console.log('🔍 Testing access token...');
            const testResponse = await axios.get('https://graph.facebook.com/v20.0/me', {
              params: {
                access_token: oauthRecord.accessToken
              }
            });
            console.log('✅ Access token test successful:', testResponse.data);
          } catch (testError) {
            console.error('❌ Access token test failed:', testError.response?.data || testError.message);
            throw new Error(`Access token is invalid: ${testError.response?.data?.error?.message || testError.message}`);
          }

          const response = await axios.post(
            'https://graph.facebook.com/v20.0/me/messages',
            requestPayload,
            {
              headers: { 
                Authorization: `Bearer ${oauthRecord.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('✅ Instagram message sent:', response.data);
          console.log('[INSTAGRAM_SEND] ✅ Message sent to Meta API successfully');

        } else if (conversation.platform === 'whatsapp') {
          console.log('[WHATSAPP_SEND] 📤 Sending message to WhatsApp at:', new Date().toISOString());
          // Get the recipient
          const otherParticipant = conversation.participants.find(p => p.toString() !== sender);
          if (!otherParticipant) {
            throw new Error('No recipient found in conversation');
          }

          // Get the user to find their WhatsApp number
          
          const recipientUser = await ClientUser.findById(otherParticipant);
          if (!recipientUser || !recipientUser.whatsappPhoneNumber) {
            throw new Error('Recipient user not found or has no WhatsApp number');
          }

          // ✅ CAMBIO: Obtener phoneNumberId desde la base de datos en lugar del .env
          if (!oauthRecord.phoneNumberId) {
            throw new Error('WhatsApp phone number not configured for this tenant');
          }

          const phoneNumberId = oauthRecord.phoneNumberId;

          // Send to WhatsApp
          const response = await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: recipientUser.whatsappPhoneNumber,
              type: 'text',
              text: { body: content }
            },
            {
              headers: { 
                Authorization: `Bearer ${oauthRecord.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('✅ WhatsApp message sent:', response.data);
          console.log('[WHATSAPP_SEND] ✅ Message sent to Meta API successfully');

        } else if (conversation.platform === 'messenger') {
          console.log('Sending message to Messenger');
          
          // Get the recipient
          const otherParticipant = conversation.participants.find(p => p.toString() !== sender);
          if (!otherParticipant) {
            throw new Error('No recipient found in conversation');
          }

          // Get the user to find their Messenger ID
          const recipientUser = await ClientUser.findById(otherParticipant);
          if (!recipientUser || !recipientUser.messengerId) {
            throw new Error('Recipient user not found or has no Messenger ID');
          }

          console.log('🔍 Recipient User:', {
            _id: recipientUser._id,
            messengerId: recipientUser.messengerId,
            name: recipientUser.name
          });

          // Send to Messenger using the service
          const result = await sendMessengerMessage(
            req.tenantId,
            recipientUser.messengerId,
            content,
            'text'
          );

          console.log('✅ Messenger message sent:', result);
        }

        // Update message status to sent
        await Message.findByIdAndUpdate(message._id, { status: 'sent' });

      } catch (platformError) {
        console.error(`[${conversation.platform.toUpperCase()}_SEND] ❌ Failed to send message to ${conversation.platform}`);
        console.error('❌ Failed to send message to platform:', platformError.response?.data || platformError.message);
        
        // Update message status to failed
        await Message.findByIdAndUpdate(message._id, { status: 'failed' });
        
        // Still return the message but with error info
        return res.status(500).json({ 
          error: 'Message saved but failed to send to external platform',
          details: platformError.response?.data || platformError.message,
          message: message
        });
      }

      // Get the final message data
      const savedMessage = await Message.findById(message._id)
        .select('_id content sender createdAt status type timestamp direction')
        .lean();

      console.log('Saved message:', savedMessage);
      res.status(201).json(savedMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async saveIncomingMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content, sender, type } = req.body;
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      console.log(req.body, 'req.body')
      try{
        const message = await Message.create({
          conversation: conversationId,
          sender,
          content,
          type,
          direction: 'inbound' // Incoming messages are always inbound
        });
      console.log(message, 'message')
      await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          convVersion: conversation.convVersion + 1
        });
        res.status(201).json(message);
      } catch (error) {
        console.error('Error saving incoming message:', error);
        res.status(500).json({ error: error.message });
      }
    } catch (error) {
      console.error('Error saving incoming message:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async findByPlatformAndExternalUser(req, res) {
    try {
      const { platform, externalUserId } = req.params;
      
      // Find conversations where this external user ID is a participant and platform matches
      const conversations = await Conversation.find({
        participants: externalUserId,
        platform: platform
      });
      
      res.status(200).json(conversations);
    } catch (error) {
      console.error('Error finding conversations by platform and external user:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getMessageById(req, res) {
    try {
      const { messageId } = req.params;
   
      
      const message = await Message.findById(messageId)
        .select('_id content sender createdAt status type timestamp')
        .lean();
      

      if (!message) {
        console.log('Backend: Message not found');
        return res.status(404).json({ error: 'Message not found' });
      }

      // Create ETag based on message ID and timestamp for individual messages
      const etag = `${message._id}-${message.createdAt}`;
      console.log('🔍 Message ETag:', etag);

      if (req.headers['if-none-match'] === etag) {
        console.log('🔍 Message ETag match, returning 304');
        return res.status(304).end();
      }

      res.setHeader('ETag', etag);
      res.status(200).json(message);
    } catch (error) {
      console.error('Backend: Error getting message by ID:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = conversationController;

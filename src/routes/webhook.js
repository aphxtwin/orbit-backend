// routes/webhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const OAuth = require('../models/OAuth');
const {handleInstagramMessage} = require('../service/instagram.js');
const {handleWhatsAppMessage} = require('../service/whatsapp.js');
const {handleMessengerMessage} = require('../service/messenger.js');

// GET de verificación Meta (igual que antes)
router.get('/', (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  
  const { ['hub.mode']: mode, ['hub.verify_token']: token, ['hub.challenge']: challenge } = req.query;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST handler for both Instagram and WhatsApp webhooks
router.post('/', async (req, res) => {
  const payload = req.body;
  const io = req.app.get('io');

  console.log('📩 RAW Webhook Payload:', JSON.stringify(payload, null, 2));
  

  
  try {
    if (payload.object === 'instagram') {
      console.log('📱 Processing Instagram message...');
      
      // El ID que llega es del usuario que envía el mensaje, NO de tu cuenta
      const senderUserId = payload.entry[0].id;
      console.log('👤 Sender User ID (client):', senderUserId);
      
      // Buscar cualquier registro de Instagram conectado (no por igUserId específico)
      const oauthRecord = await OAuth.findOne({ 
        channel: 'instagram',
        igUserId: senderUserId,
        status: 'connected'
      });

      if (!oauthRecord) {
        console.error('❌ No connected Instagram OAuth found');
        
        // Debug: buscar todos los registros de Instagram para ver qué hay
        const allInstagramRecords = await OAuth.find({ channel: 'instagram' });
        console.log('🔍 All Instagram OAuth records:', allInstagramRecords.map(r => ({
          tenant: r.tenant,
          igUserId: r.igUserId,
          status: r.status
        })));
        
        return res.status(500).json({ error: 'No Instagram OAuth configuration found' });
      }
      
      // Obtener el accessToken de la base de datos
      const accessToken = oauthRecord.accessToken;
      if (!accessToken) {
        console.error('❌ No access token found for Instagram OAuth');
        return res.status(500).json({ error: 'No access token available' });
      }
      
      // Debug: verificar el token
      console.log('🔍 Access Token from DB:', accessToken.substring(0, 20) + '...');
      console.log('🔍 Token length:', accessToken.length);
      console.log('🔍 Token format valid:', accessToken.startsWith('EAA'));
      
      const tenantId = oauthRecord.tenant.toString();
      console.log('✅ Using access token from database for tenant:', tenantId);
      console.log('🏢 Your Instagram Business Account ID:', oauthRecord.igUserId);
      console.log('👤 Message from client ID:', senderUserId);
      
      await handleInstagramMessage(payload, io, accessToken, tenantId);
    } 
    else if (payload.object === 'whatsapp_business_account') {
      console.log('💬 Processing WhatsApp message...');
      
      // Get tenant from OAuth configuration for WhatsApp
      const oauthRecord = await OAuth.findOne({ 
        channel: 'whatsapp',
        status: 'connected'
      });
      
      const tenantId = oauthRecord?.tenant?.toString();
      if (!tenantId) {
        console.error('❌ No connected WhatsApp OAuth found');
        return res.status(500).json({ error: 'No WhatsApp OAuth configuration found' });
      }
      
      await handleWhatsAppMessage(payload, io, tenantId);
    }
    else if (payload.object === 'page') {
      console.log('💬 Processing Messenger message...');
      
      // Get tenant from OAuth configuration for Messenger
      const oauthRecord = await OAuth.findOne({ 
        channel: 'messenger',
        status: 'connected'
      });
      
      if (!oauthRecord) {
        console.error('❌ No connected Messenger OAuth found');
        return res.status(500).json({ error: 'No Messenger OAuth configuration found' });
      }
      
      const accessToken = oauthRecord.accessToken;
      if (!accessToken) {
        console.error('❌ No access token found for Messenger OAuth');
        return res.status(500).json({ error: 'No access token available' });
      }
      
      const tenantId = oauthRecord.tenant.toString();
      console.log('✅ Using access token from database for tenant:', tenantId);
      console.log('🏢 Your Page ID:', oauthRecord.pageId);
      
      await handleMessengerMessage(payload, io, accessToken, tenantId);
    }
    else {
      console.log('❓ Unknown webhook object:', payload.object);
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.sendStatus(200);
});


// Updated Instagram OAuth handler with debugging
router.get('/instagram-auth', async (req, res) => {
  const code = req.query.code;
    if (!code) {
      return res.status(200).json({ message: 'OK - waiting for code' });
  }
  console.log('📥 OAuth Code Received:', code);

  // Verify environment variables
  console.log('🔍 Environment check:');
  console.log('- CLIENT_ID:', process.env.FB_CLIENT_ID); 
  console.log('- REDIRECT_URI:', `${process.env.NGROK_URL}/webhook/instagram-auth`);
  console.log('- CLIENT_SECRET exists:', !!process.env.FB_CLIENT_SECRET);

  try {
    // ONLY use Facebook Graph API for Instagram Business messaging
    const response = await axios({
      method: 'get',
      url: 'https://graph.facebook.com/v18.0/oauth/access_token',
      params: {
        client_id: process.env.FB_CLIENT_ID,
        client_secret: process.env.FB_CLIENT_SECRET,
        redirect_uri: `${process.env.NGROK_URL}/webhook/instagram-auth`,
        code
      }
    });

    console.log('✅ Access Token Response:', response.data);
    const accessToken = response.data.access_token;

    // Store the token securely (you might want to save this in your database)
    console.log('💾 Access Token obtained:', accessToken.substring(0, 20) + '...');

    return res.send('✅ Instagram Business login successful! You can now receive messages.');
  } catch (error) {
    console.error('❌ Token exchange failed:', error.response?.data || error.message);
    
    // Provide specific error details
    if (error.response?.data?.error?.code === 191) {
      return res.status(500).send(`Domain Error: Make sure 'messaging.bici-dev.com' is added to App Domains in your Facebook App settings. Error: ${error.response.data.error.message}`);
    }
    
    return res.status(500).send(`Failed to exchange code: ${error.response?.data?.error?.message || error.message}`);
  }
});

router.get('/whatsapp-auth', async (req, res) => {
    console.log('🔍 WhatsApp Auth Request:', req.query);
    
    // Handle webhook verification challenge
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    const code = req.query.code;
    
    // If this is a webhook verification request
    if (mode === 'subscribe' && challenge) {
        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'hola_moto13';
        
        if (token === VERIFY_TOKEN) {
            console.log('✅ WhatsApp webhook verified successfully');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ WhatsApp webhook verification failed - wrong token');
            console.log('Expected:', VERIFY_TOKEN);
            console.log('Received:', token);
            return res.sendStatus(403);
        }
    }
    
    // Handle OAuth code exchange
    if (code) {
        console.log('📥 WhatsApp OAuth Code Received:', code);
        // TODO: Implement WhatsApp OAuth token exchange
        return res.send('✅ WhatsApp OAuth code received. Token exchange not implemented yet.');
    }
    
    return res.status(200).json({ message: 'OK - waiting for code or verification' });
});
  

// POST mock (para testear desde Postman)
router.post('/whatsapp-api-send', (req, res) => {
  const message = req.body.message || 'This is a mock message!';
  const sender  = req.body.from    || '123456789';

  const mockPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'MOCK_WABA_ID',
      changes: [{
        value: {
          messages: [{
            from: sender,
            id:   'mock-msg-id',
            timestamp: `${Date.now()}`,
            text: { body: message }
          }],
          metadata: { phone_number_id: 'MOCK_PHONE_ID' }
        },
        field: 'messages'
      }]
    }]
  };

  console.log('🧪 MOCK MESSAGE RECEIVED:', JSON.stringify(mockPayload, null, 2));

  // 👉 También lo empujás a los clientes WebSocket
  req.app.get('io').emit('whatsapp:event', mockPayload);

  res.status(200).json({ status: 'ok', mock: true });
});

// POST mock (para testear Instagram desde Postman)
router.post('/instagram-api-send', (req, res) => {
  const message = req.body.message || 'This is a mock Instagram message!';
  const sender  = req.body.from    || 'mock_ig_user_id';

  const mockPayload = {
    object: 'instagram',
    entry: [{
      id: 'MOCK_IG_ID',
      messaging: [{
        sender: { id: sender },
        recipient: { id: 'MOCK_IG_PAGE_ID' },
        timestamp: Date.now(),
        message: {
          mid: 'mock-ig-msg-id',
          text: message
        }
      }]
    }]
  };

  console.log('🧪 MOCK INSTAGRAM MESSAGE RECEIVED:', JSON.stringify(mockPayload, null, 2));

  // Emitirlo a los clientes WebSocket igual que el real
  const formattedMessage = {
    id: mockPayload.entry[0].messaging[0].message.mid,
    content: mockPayload.entry[0].messaging[0].message.text,
    sender: mockPayload.entry[0].messaging[0].sender.id,
    timestamp: new Date(mockPayload.entry[0].messaging[0].timestamp),
    platform: 'instagram',
    read: false
  };

  req.app.get('io').emit('instagram:event', {
    from: sender,
    message: formattedMessage
  });

  res.status(200).json({ status: 'ok', mock: true });
});

// Debug endpoint to check what IDs we have
router.get('/debug-ids', async (req, res) => {
  res.json({
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    META_APP_ID: process.env.META_APP_ID,
    hasToken: !!process.env.LONG_LIVED_TOKEN
  });
});

// Test Meta Graph API connection and find correct phone numbers
router.get('/test-meta-api', async (req, res) => {
  try {
    console.log('🔍 Testing Meta Graph API connection...');
    console.log('🔍 Trying to get app info first...');
    
    // Try to get app info to validate token
    const appResult = await axios.get(
      `https://graph.facebook.com/v19.0/me?fields=id,name`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LONG_LIVED_TOKEN}`,
        }
      }
    );
    
    console.log('✅ App/User info:', appResult.data);
    
    let phoneInfo = null;
    let phoneError = null;
    
    // Now try to get phone number info
    try {
      const phoneResult = await axios.get(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating`,
        {
          headers: {
            Authorization: `Bearer ${process.env.LONG_LIVED_TOKEN}`,
          }
        }
      );
      phoneInfo = phoneResult.data;
    } catch (phoneErr) {
      phoneError = phoneErr.response?.data || phoneErr.message;
    }
    
    res.json({
      success: true,
      appInfo: appResult.data,
      phoneInfo: phoneInfo,
      phoneError: phoneError,
      currentPhoneId: process.env.PHONE_NUMBER_ID,
      message: 'Meta API token is valid but phone number may be incorrect'
    });
  } catch (err) {
    console.error('❌ Meta API test error:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message,
      message: 'Meta API connection failed - token may be invalid'
    });
  }
});

module.exports = router;

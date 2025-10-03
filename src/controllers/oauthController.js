const { OAuth, Tenant } = require('../models');
const axios = require('axios');

const FB_CLIENT_ID = process.env.FB_CLIENT_ID;
const FB_CLIENT_SECRET = process.env.FB_CLIENT_SECRET;

const oauthController = {
  /**
   * Get OAuth configuration for a specific tenant and channel
   */
  async getConfig(req, res) {
    try {
      const { tenantId, channel } = req.params;

      const validChannels = ['instagram', 'whatsapp', 'messenger'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      let oauth = await OAuth.findOne({ tenant: tenantId, channel });

      if (!oauth) {
        return res.json({
          tenantId,
          channel,
          status: 'disconnected',
          waConfigId: '',
          isConfigured: false,
          igUserId: ''  
        });
      }

      res.json({
        tenantId,
        channel,
        status: oauth.status,
        waConfigId: oauth.waConfigId || '',
        isConfigured: true,
        isConnected: oauth.isConnected(),
        igUserId: oauth.igUserId || ''
      });

    } catch (error) {
      console.error('❌ OAuth Config Get Error:', error);
      res.status(500).json({ error: 'Error getting OAuth configuration' });
    }
  },

  /**
   * Update OAuth configuration for a specific tenant and channel
   * (Only stores tenant-specific info like waConfigId now)
   */
  async updateConfig(req, res) {
    try {
      const { tenantId, channel } = req.params;
      const { waConfigId } = req.body;

      const validChannels = ['instagram', 'whatsapp', 'messenger'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      let oauth = await OAuth.findOne({ tenant: tenantId, channel });

      if (!oauth) {
        oauth = new OAuth({
          tenant: tenantId,
          channel,
          waConfigId: waConfigId || ''
        });
      } else {
        if (waConfigId) {
          oauth.waConfigId = waConfigId;
        }
      }

      await oauth.save();

      res.json({
        message: 'OAuth configuration updated successfully',
        tenantId,
        channel,
        isConfigured: true
      });

    } catch (error) {
      console.error('❌ OAuth Config Update Error:', error);
      res.status(500).json({ error: 'Error updating OAuth configuration' });
    }
  },

  /**
   * Start OAuth flow for a specific tenant and channel
   */
  async connect(req, res) {
    try {
      const { tenantId, channel } = req.params;
      console.log("FB_CLIENT_ID", FB_CLIENT_ID);
      console.log("FB_CLIENT_SECRET", FB_CLIENT_SECRET);
      const validChannels = ['instagram', 'whatsapp', 'messenger'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      let oauth = await OAuth.findOne({ tenant: tenantId, channel });
      if (!oauth) {
        console.log(`�� Creating new OAuth configuration for tenant ${tenantId}, channel ${channel}`);
        
        // Create new OAuth configuration
        oauth = await OAuth.create({
          tenant: tenantId,
          channel: channel,
          status: 'disconnected',
          // For WhatsApp, we might need additional config
          ...(channel === 'whatsapp' && {
            waConfigId: process.env.WHATSAPP_CONFIG_ID || null
          })
        });
        
        console.log(`✅ Created OAuth configuration: ${oauth._id}`);
      }
      let authUrl;
      const redirectUri = `${process.env.API_BASE_URL}/oauth/callback/${channel}`;
      console.log("redirectUri", redirectUri);
      const state = `${tenantId}:${channel}`;
      console.log("state", state);
      switch (channel) {
        case 'instagram':
          const instagramScopes = [
            'instagram_basic',
            'instagram_manage_messages',
            'pages_show_list',
            'business_management',
            'pages_messaging'  // Agregar este permiso
          ];
          authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(instagramScopes.join(','))}&response_type=code&state=${encodeURIComponent(state)}`;
          
          console.log("authUrl", authUrl);
          break;

        case 'messenger':
          const messengerScopes = [
            'pages_show_list',
            'pages_messaging',
            'business_management'
          ];
          authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(messengerScopes.join(','))}&response_type=code&state=${encodeURIComponent(state)}`;
          break;

        case 'whatsapp':
          // ✅ NUEVO: WhatsApp no necesita waConfigId, se puede conectar directamente
          const whatsappScopes = [
            'whatsapp_business_management',
            'whatsapp_business_messaging',
            'business_management'
          ];
          authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(whatsappScopes.join(','))}&response_type=code&state=${encodeURIComponent(state)}`;
          break;
      }

      res.json({ authUrl, channel, tenantId, redirectUri });

    } catch (error) {
      console.error('❌ OAuth Connect Error:', error);
      res.status(500).json({ error: 'Error starting OAuth flow' });
    }
  },

  /**
   * Handle OAuth callback
   */
  async callback(req, res) {
    try {
      const { channel } = req.params;
      const { code, state, error } = req.query;

      const validChannels = ['instagram', 'whatsapp', 'messenger'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
      }

      if (error) {
        console.error('❌ OAuth Callback Error:', error);
        return res.status(400).json({ error: `OAuth error: ${error}` });
      }

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const [tenantId, channelFromState] = state.split(':');
      if (channelFromState !== channel) {
        return res.status(400).json({ error: 'Channel mismatch in state' });
      }

      const oauth = await OAuth.findOne({ tenant: tenantId, channel });
      if (!oauth) {
        return res.status(404).json({ error: 'OAuth configuration not found' });
      }

      const tokenResponse = await axios.get(`https://graph.facebook.com/v20.0/oauth/access_token`, {
        params: {
          client_id: FB_CLIENT_ID,
          client_secret: FB_CLIENT_SECRET,
          redirect_uri: `${process.env.API_BASE_URL}/oauth/callback/${channel}`,
          code
        }
      });

      const { access_token, expires_in } = tokenResponse.data;
      const expiresAt = (expires_in && expires_in > 0)
        ? new Date(Date.now() + expires_in * 1000)
        : null;     
      console.log('access_token', access_token);
      console.log('expires_in', expires_in);
      console.log('expiresAt', expiresAt);

      // ✅ AQUÍ: Intercambiar por long-lived token para TODOS los canales
      console.log('🔄 Intercambiando token por long-lived token...');
      const longLivedTokenResponse = await axios.get(
        'https://graph.facebook.com/v20.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: FB_CLIENT_ID,
            client_secret: FB_CLIENT_SECRET,
            fb_exchange_token: access_token
          }
        }
      );

      const { access_token: longLivedToken } = longLivedTokenResponse.data;
      console.log('✅ Long-lived token obtenido:', longLivedToken ? 'EXISTS' : 'MISSING');

      // Para IG/Messenger: validar permisos y listar páginas...
      if (channel === 'instagram' || channel === 'messenger') {
        // Usar longLivedToken en todas las llamadas
        const permsResp = await axios.get('https://graph.facebook.com/v20.0/me/permissions', {
          params: { access_token: longLivedToken }
        });

        // 2) Si falta pages_show_list, cortamos con mensaje claro
        const granted = new Map((permsResp.data?.data || []).map(p => [p.permission, p.status]));
        if (granted.get('pages_show_list') !== 'granted') {
          return res.status(400).json({
            error: 'pages_show_list not granted',
            details: 'El usuario no concedió acceso a páginas',
            fix: 'Reintentar login y en "Editar acceso" seleccionar la(s) Página(s).'
          });
        }

        // 3) Ahora probamos /me/accounts
        const pagesResp = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
          params: { 
            access_token: longLivedToken,
            fields: 'id,name,instagram_business_account,access_token'
          }
        });
        console.log('PAGE ACCOUNT LISTED ->', JSON.stringify(pagesResp.data, null, 2));

        const pages = (pagesResp.data?.data || []).map(p => ({
          id: p.id,
          name: p.name,
          instagram_business_account: p.instagram_business_account // Agregar esto
        }));

        // 4) INTEGRAR SELECT PAGE: Automáticamente seleccionar la primera página con Instagram
        let selectedPage = null;
        let igUserId = null;
        let pageAccessToken = null;
        let pageName = null;

        if (channel === 'instagram') {
          // Buscar la primera página que tenga cuenta de Instagram Business
          selectedPage = pages.find(page => page.instagram_business_account);
          
          if (selectedPage) {
            
            // Obtener token de página y detalles de Instagram
            const pageResp = await axios.get(`https://graph.facebook.com/v20.0/${selectedPage.id}`, {
              params: {
                fields: 'access_token,name,instagram_business_account',
                access_token: longLivedToken
              }
            });
            console.log('pageResp', pageResp.data);
            pageName = pageResp.data?.name;
            pageAccessToken = pageResp.data?.access_token;
            console.log('pageName', pageName);
            console.log('pageAccessToken', pageAccessToken);

            if (pageResp.data?.instagram_business_account) {
              igUserId = pageResp.data.instagram_business_account.id;
              console.log('✅ Instagram Business Account ID obtained:', igUserId);
            }
          } else {
            console.log('⚠️ No page with Instagram Business found, keeping pending_page_selection');
          }
        }

        // 5) Guardar conexión según si se encontró página o no
        if (selectedPage && igUserId) {
          // Conexión completa automática
          await oauth.updateConnection({
            accessToken: pageAccessToken,        // ← Token de página (actual)
            longLivedToken: longLivedToken,     // ← Long-lived como respaldo
            refreshToken: null,
            expiresAt: null,                     // ← Token de página no expira
            pageId: selectedPage.id,
            pageName: pageName,
            igUserId: igUserId,
            status: 'connected'
          });

          // 6) ACTIVAR WEBHOOK AUTOMÁTICAMENTE
          try {
            console.log(' Activating webhook automatically...');
            
            // Suscribir el webhook a la página
            
            // Para Instagram Messaging, usar campos específicos de Instagram
            const subscribeResponse = await axios.post(`https://graph.facebook.com/v20.0/${selectedPage.id}/subscribed_apps`, {
              access_token: pageAccessToken,
              subscribed_fields: 'messages,messaging_postbacks'
            });
            
            console.log('✅ Webhook subscribed to page:', subscribeResponse.data);
            
            // También suscribir al Instagram Business Account
            const instagramSubscribeResponse = await axios.post(`https://graph.facebook.com/v20.0/${igUserId}/subscribed_apps`, {
              access_token: pageAccessToken,
              subscribed_fields: 'messages,messaging_postbacks'
            });
            
            console.log('✅ Webhook subscribed to Instagram Business Account:', instagramSubscribeResponse.data);
            
          } catch (webhookError) {
            console.error('❌ Error activating webhook:', webhookError.response?.data || webhookError.message);
            // No fallar la conexión si el webhook falla
          }

          // ✅ STRATEGY 1: Create dual Instagram + Messenger connection
          if (channel === 'instagram') {
            console.log('🔄 Creating dual Instagram + Messenger connection...');
            
            // Create Messenger OAuth record based on Instagram connection
            await OAuth.findOneAndUpdate(
              { tenant: tenantId, channel: 'messenger' },
              {
                tenant: tenantId,
                channel: 'messenger',
                status: 'connected',
                accessToken: pageAccessToken,
                longLivedToken: longLivedToken,
                refreshToken: null,
                expiresAt: null,
                pageId: selectedPage.id,
                pageName: pageName,
                // No igUserId for Messenger
                lastConnected: new Date()
              },
              { upsert: true }
            );
            
            console.log('✅ Created dual Instagram + Messenger connection');
          }

          // For Messenger, redirect to frontend after successful connection
          if (channel === 'messenger') {
            const frontendUrl = process.env.FRONTEND_URL || 'https://orbitg.bici-dev.com';
            const redirectUrl = `${frontendUrl}/canales`;
            
            console.log('✅ Messenger connected successfully, redirecting to:', redirectUrl);
            return res.redirect(redirectUrl);
          }
          
          // For Instagram, redirect to frontend after successful connection
          const frontendUrl = process.env.FRONTEND_URL || 'https://orbitg.bici-dev.com';
          const redirectUrl = `${frontendUrl}/canales`;
          
          console.log('✅ Instagram connected successfully, redirecting to:', redirectUrl);
          return res.redirect(redirectUrl);
        } else {
          // Estado pendiente de selección manual
          await oauth.updateConnection({
            accessToken: longLivedToken,        // ← Usar long-lived token
            longLivedToken: longLivedToken,     // ← Respaldo
            refreshToken: null,
            expiresAt: null,                     // ← Long-lived no expira
            status: 'pending_page_selection'
          });

          // ✅ STRATEGY 1: Create dual Instagram + Messenger connection (pending state)
          if (channel === 'instagram') {
            console.log('🔄 Creating dual Instagram + Messenger connection (pending page selection)...');
            
            // Create Messenger OAuth record in pending state
            await OAuth.findOneAndUpdate(
              { tenant: tenantId, channel: 'messenger' },
              {
                tenant: tenantId,
                channel: 'messenger',
                status: 'pending_page_selection',
                accessToken: longLivedToken,
                longLivedToken: longLivedToken,
                refreshToken: null,
                expiresAt: null,
                lastConnected: new Date()
              },
              { upsert: true }
            );
            
            console.log('✅ Created dual Instagram + Messenger connection (pending)');
          }

          // For Messenger, redirect to frontend even if pending page selection
          if (channel === 'messenger') {
            const frontendUrl = process.env.FRONTEND_URL || 'https://orbitg.bici-dev.com';
            const redirectUrl = `${frontendUrl}/canales`;
            
            console.log('✅ Messenger connection pending page selection, redirecting to:', redirectUrl);
            return res.redirect(redirectUrl);
          }
          
          // For Instagram, redirect to frontend even if pending page selection
          const frontendUrl = process.env.FRONTEND_URL || 'https://orbitg.bici-dev.com';
          const redirectUrl = `${frontendUrl}/canales`;
          
          console.log('✅ Instagram connection pending page selection, redirecting to:', redirectUrl);
          return res.redirect(redirectUrl);
        }
      }

      // WhatsApp: flujo específico para WhatsApp Business
      if (channel === 'whatsapp') {
        console.log('🔍 WhatsApp OAuth Callback - Iniciando...');
        
        // ✅ Usar longLivedToken para WhatsApp
        await oauth.updateConnection({
          status: 'connected',
          accessToken: longLivedToken, // ← Long-lived token
          longLivedToken: longLivedToken, // ← También guardarlo en el campo específico
          expiresAt: null // ← Long-lived no expira
        });
        
        // ✅ Usar longLivedToken para obtener business info
        const businessesResponse = await axios.get(
          'https://graph.facebook.com/v20.0/me?fields=businesses',
          { params: { access_token: longLivedToken } }
        );
        
        console.log('🔍 Business response:', JSON.stringify(businessesResponse.data, null, 2));
        
        const business = businessesResponse.data.businesses.data.find(
          b => b.name === ' Jose luis spironello'
        ) || businessesResponse.data.businesses.data[0];
        // obtener el primer business que tenga whatsapp_business_management PERO 
        // FALLA SI EL PRIMERO NO ES EL PORTAFOLIO CORRECTO
        console.log('🔍 Business encontrado:', business);
        
        // ✅ PASO 1: Obtener WhatsApp Business Accounts del business
        const wabaResponse = await axios.get(
          `https://graph.facebook.com/v20.0/${business.id}/owned_whatsapp_business_accounts`,
          { params: { access_token: longLivedToken } }
        );
        
        console.log('🔍 WhatsApp Business Accounts response:', JSON.stringify(wabaResponse.data, null, 2));
        
        const wabaAccounts = wabaResponse.data.data;
        if (!wabaAccounts || wabaAccounts.length === 0) {
          throw new Error('No se encontraron cuentas de WhatsApp Business para este business');
        }
        
        // Tomar la primera cuenta de WhatsApp Business
        const wabaAccount = wabaAccounts[0];
        console.log('✅ WhatsApp Business Account encontrada:', wabaAccount);
        
        // ✅ PASO 2: Obtener phone numbers de la WhatsApp Business Account
        const phoneNumbersResponse = await axios.get(
          `https://graph.facebook.com/v20.0/${wabaAccount.id}/phone_numbers`,
          { params: { access_token: longLivedToken } }
        );
        
        console.log('🔍 Phone numbers response:', JSON.stringify(phoneNumbersResponse.data, null, 2));
        
        const phoneNumbers = phoneNumbersResponse.data.data;
        if (!phoneNumbers || phoneNumbers.length === 0) {
          throw new Error('No se encontraron números de teléfono para el business de WhatsApp');
        }
        
        // Tomar el primer número de teléfono disponible
        const phoneNumber = phoneNumbers[0];
        console.log('✅ Phone number encontrado:', phoneNumber);
        console.log('🔍 Phone number details:', {
          id: phoneNumber.id,
          display_phone_number: phoneNumber.display_phone_number,
          verified_name: phoneNumber.verified_name,
          name: phoneNumber.name
        });

        // ✅ Actualizar OAuth con businessId y phoneNumberId
        await oauth.updateConnection({
          businessId: business.id,
          phoneNumberId: phoneNumber.id,
          phoneNumber: phoneNumber.display_phone_number
        });

        console.log('✅ OAuth actualizado con phoneNumber:', phoneNumber);
        console.log('✅ OAuth actualizado con phoneNumberId:', phoneNumber.id);
        
        // ✅ Redirigir al frontend - WhatsApp conectado completamente
        const frontendUrl = process.env.FRONTEND_URL || 'https://orbitg.bici-dev.com';
        const redirectUrl = `${frontendUrl}/canales`;
        
        console.log('✅ Redirigiendo a:', redirectUrl);
        return res.redirect(redirectUrl);
      }

    } catch (error) {
      console.error('❌ OAuth Callback Error:', error);
      try {
        const [tenantId, channel] = req.query.state?.split(':') || [];
        if (tenantId && channel) {
          const oauth = await OAuth.findOne({ tenant: tenantId, channel });
          if (oauth) {
            await oauth.setError(error.message || error);
          }
        }
      } catch (updateError) {
        console.error('❌ Error updating OAuth connection with error:', updateError);
      }
      res.status(500).json({ error: 'Error processing OAuth callback', details: error.message });
    }
  },

  async selectPage(req, res) {
    try {
      const { tenantId, channel } = req.params;
      const { pageId } = req.body;

      if (!['instagram', 'messenger'].includes(channel)) {
        return res.status(400).json({ error: 'Page selection available only for instagram or messenger' });
      }
      if (!pageId) {
        return res.status(400).json({ error: 'pageId es requerido' });
      }

      const oauth = await OAuth.findOne({ tenant: tenantId, channel });
      if (!oauth) {
        return res.status(404).json({ error: 'OAuth configuration not found' });
      }
      if (!oauth.accessToken) {
        return res.status(400).json({ error: 'Falta access token, reinicia el flujo OAuth' });
      }

      // Usando el token de usuario guardado, obtengo el token de la página seleccionada
      const pageResp = await axios.get(`https://graph.facebook.com/v20.0/${pageId}`, {
        params: {
          fields: 'access_token,name,instagram_business_account',
          access_token: oauth.accessToken
        }
      });

      const pageName = pageResp.data?.name;
      const pageAccessToken = pageResp.data?.access_token;
      let igUserId;

      if (channel === 'instagram' && pageResp.data?.instagram_business_account) {
        igUserId = pageResp.data.instagram_business_account.id;
      }

      await oauth.updateConnection({
        accessToken: pageAccessToken || oauth.accessToken, // guardar token de página
        refreshToken: null,
        expiresAt: oauth.expiresAt,
        pageId,
        pageName,
        igUserId,
        status: 'connected'
      });

      return res.json({
        success: true,
        message: `${channel} connected successfully`,
        tenantId,
        channel,
        pageId,
        pageName
      });
    } catch (error) {
      console.error('❌ OAuth Select Page Error:', error);
      try {
        const oauth = await OAuth.findOne({ tenant: req.params.tenantId, channel: req.params.channel });
        if (oauth) await oauth.setError(error.message || error);
      } catch (_) {}
      return res.status(500).json({ error: 'Error selecting page', details: error.message });
    }
  },

  async getStatus(req, res) {
    try {
      const { tenantId } = req.params;
      const connections = await OAuth.find({ tenant: tenantId });
      const status = {
        tenantId,
        connections: connections.map(conn => ({
          channel: conn.channel,
          status: conn.status,
          isConnected: conn.isConnected(),
          lastConnected: conn.lastConnected,
          pageName: conn.pageName
        }))
      };
      res.json(status);
    } catch (error) {
      console.error('❌ OAuth Status Error:', error);
      res.status(500).json({ error: 'Error getting OAuth status' });
    }
  },

  async disconnect(req, res) {
    try {
      const { tenantId, channel } = req.params;
      
      console.log(`🔄 Disconnecting ${channel} for tenant ${tenantId}`);
      
      // Buscar la conexión principal
      const oauth = await OAuth.findOne({ tenant: tenantId, channel });
      if (!oauth) {
        return res.status(404).json({ error: 'OAuth connection not found' });
      }
      
      console.log(`✅ Found ${channel} connection, status: ${oauth.status}`);
      
      // Desconectar la conexión principal
      await oauth.disconnect();
      console.log(`✅ ${channel} disconnected successfully`);
      
      // ✅ NUEVO: Si es Instagram, también desconectar Messenger
      if (channel === 'instagram') {
        console.log('�� Disconnecting dual Instagram + Messenger connection...');
        
        const messengerOAuth = await OAuth.findOne({ tenant: tenantId, channel: 'messenger' });
        if (messengerOAuth) {
          console.log(`✅ Found Messenger connection, status: ${messengerOAuth.status}`);
          await messengerOAuth.disconnect();
          console.log('✅ Messenger also disconnected');
        } else {
          console.log('⚠️ No Messenger connection found to disconnect');
        }
      }
      
      // ✅ NUEVO: Si es Messenger, también desconectar Instagram
      if (channel === 'messenger') {
        console.log('�� Disconnecting dual Messenger + Instagram connection...');
        
        const instagramOAuth = await OAuth.findOne({ tenant: tenantId, channel: 'instagram' });
        if (instagramOAuth) {
          console.log(`✅ Found Instagram connection, status: ${instagramOAuth.status}`);
          await instagramOAuth.disconnect();
          console.log('✅ Instagram also disconnected');
        } else {
          console.log('⚠️ No Instagram connection found to disconnect');
        }
      }
      
      res.json({ 
        message: `${channel} disconnected successfully`,
        dualDisconnect: channel === 'instagram' || channel === 'messenger'
      });
      
    } catch (error) {
      console.error('❌ OAuth Disconnect Error:', error);
      res.status(500).json({ error: 'Error disconnecting OAuth' });
    }
  }
};

module.exports = oauthController;


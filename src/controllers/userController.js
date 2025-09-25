const { ClientUser } = require('../models');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const InternalUser = require('../models/InternalUser'); // ✅ AGREGAR
const { getInstagramUserName } = require('../utils/instagramApi');
const OdooService = require('../service/odooService'); 

// Helper functions for conversation consolidation
/**
 * Group conversations by channel/platform
 * @param {Array} conversations - Array of conversation objects
 * @returns {Object} Map of channel -> conversations array
 */
function groupByChannel(conversations) {
  const map = {};
  for (const conv of conversations) {
    const channel = conv.platform; // 'whatsapp' or 'instagram'
    if (!map[channel]) map[channel] = [];
    map[channel].push(conv);
  }
  return map;
}

/**
 * Consolidate duplicate conversations for the same channel
 * @param {Array} conversations - Conversations for the same channel
 * @returns {Object} { canonical, duplicates }
 */
function selectCanonicalConversation(conversations) {
  // If there's only one conversation, return it as canonical and no duplicates
  if (conversations.length <= 1) {
    return { canonical: conversations[0], duplicates: [] };
  }

  // Sort by creation date (oldest first) and use oldest as canonical
  const sorted = conversations.sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );

  return {
    canonical: sorted[0],        // Keep the oldest conversation
    duplicates: sorted.slice(1)  // Mark the rest as duplicates
  };
}

const userController = {
  /**
   * Get current authenticated user
   */
  async getMe(req, res) {
    try {
      console.log('🔍 DEBUG - getMe called for app user');
      console.log('🔍 DEBUG - req.appUser:', req.appUser);
      
      if (!req.appUser) {
        return res.status(401).json({ error: 'App user not authenticated' });
      }

      return res.json({
        id: req.appUser._id,
        email: req.appUser.email,
        name: req.appUser.name,
        odooUserId: req.appUser.odooUserId,
        role: req.appUser.role, // admin, agent, manager, etc.
        permissions: req.appUser.permissions
      });
    } catch (error) {
      console.error('Error in getMe:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      const user = await ClientUser.create({ 
        name: req.body.name,
        tenantId: req.tenantId,
        role: 'client',
        type: 'ClientUser'
      });
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Finds a user by Instagram ID, or creates one using name (or fetches name if missing)
   * @param {string|object} sender - Instagram ID or full sender object
   * @param {string|null} [name] - Optional name to use when creating the user
   * @param {string} [accessToken] - Optional token to fetch name if not provided
   * @param {string} [platform] - Platform type ('instagram', 'whatsapp', or 'messenger')
   * @param {string} [tenantId] - Tenant ID for the user
   */
  async getUserOrCreate(sender, name = null, accessToken = null, platform = 'instagram', tenantId = null) {
    if (platform === 'messenger') {
      // Handle Messenger user creation
      const messengerId = typeof sender === 'string' ? sender : sender?.id;

      if (!messengerId) {
        throw new Error('Missing Messenger ID');
      }

      // Check if user already exists by messengerId
      let user = await ClientUser.findOne({ messengerId: messengerId });

      if (user) return user;

      // Create new Messenger user
      const userData = {
        name: name || `Messenger User ${messengerId}`,
        messengerId: messengerId,
        tenantId: tenantId,
        role: 'client',
        type: 'ClientUser'
      };

      console.log('Creating new Messenger user:', userData);
      user = await ClientUser.create(userData);
      return user;
    }
    else if (platform === 'whatsapp') {
      // Handle WhatsApp user creation
      const phoneNumber = typeof sender === 'string' ? sender : sender?.id;

      if (!phoneNumber) {
        throw new Error('Missing WhatsApp phone number');
      }

      // Check if user already exists by whatsappPhoneNumber
      let user = await ClientUser.findOne({ whatsappPhoneNumber: phoneNumber });

      if (user) return user;

      // Create new WhatsApp user
      const userData = {
        name: name || `WhatsApp User ${phoneNumber}`,
        whatsappPhoneNumber: phoneNumber,
        tenantId: tenantId,
        role: 'client',
        type: 'ClientUser'
      };

      console.log('Creating new WhatsApp user:', userData);
      user = await ClientUser.create(userData);
      return user;
    }
    // Instagram handling (existing logic)
    const instagramId = typeof sender === 'string' ? sender : sender?.id;
    console.log('instagramId AAAA', instagramId);

      if (!instagramId) {
        console.log('Missing Instagram ID');
        throw new Error('Missing Instagram ID');
      }

    // Check if user already exists by instagramId
    let user = await ClientUser.findOne({ instagramId });

      if (user) {
        console.log('User already exists', user);
        return user;
      }

    // If name is not provided, try to fetch it from Instagram API
    let userName = name;
    if (!userName && accessToken) {
      try {
        userName = await getInstagramUserName(instagramId, accessToken);
      } catch (error) {
        console.warn('Could not fetch Instagram username:', error.message);
        userName = `Instagram User ${instagramId}`;
      }
    }

    // If still no name, use a default
    if (!userName) {
      userName = `Instagram User ${instagramId}`;
    }

    // Create new user
    const userData = {
      name: userName,
      tenantId: tenantId,
      instagramId,
      role: 'client',
      type: 'ClientUser'
    };

    console.log('Creating new Instagram user:', userData);
    user = await ClientUser.create(userData);
    return user;
  },

  async getUserById(req, res) {
    try {
      const user = await ClientUser.findById(req.params.userId).populate('assignedSalesman', 'name email'); // ✅ AGREGAR populate
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Para buscar múltiples usuarios por sus IDs
  async getUsersByIds(req, res) {
    try {
      const { ids } = req.body;
      const users = await ClientUser.find({ _id: { $in: ids } });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      console.log('🚀 ===== USER UPDATE STARTED =====');
      console.log('🔍 DEBUG - Request params:', req.params);
      console.log('🔍 DEBUG - Request body:', req.body);
      console.log('🔍 DEBUG - Odoo session ID:', req.odooSessionId);
      console.log('🔍 DEBUG - Odoo session type:', typeof req.odooSessionId);
      console.log('🔍 DEBUG - Odoo session length:', req.odooSessionId?.length);
      console.log('🔍 DEBUG - Tenant Rex URL:', req.tenantRexUrl); // ✅ CAMBIO 2: Log tenant URL

      // ✅ PASO 1: Obtener el usuario actual antes de la actualización
      const currentUser = await ClientUser.findById(req.params.id);
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('🔍 DEBUG - Current user before update:', {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        whatsappPhoneNumber: currentUser.whatsappPhoneNumber,
        instagramId: currentUser.instagramId,
        syncStatus: currentUser.syncStatus,
        odooPartnerId: currentUser.odooPartnerId,
        odooLeadId: currentUser.odooLeadId
      });

      // ✅ PASO 2: Actualizar en MongoDB
      console.log('🔄 Updating user in MongoDB...');
      
      // ✅ Mapear salesman a assignedSalesman para compatibilidad
      const updateData = { ...req.body };
      
      // Si viene salesman pero no assignedSalesman, buscar el ObjectId
      if (req.body.salesman && !req.body.assignedSalesman) {
        try {
          console.log('🔍 Searching for salesman:', req.body.salesman);
          
          const allSalesmen = await InternalUser.find({}, 'name email');
          console.log('📋 Available salesmen:', allSalesmen.map(s => ({ name: s.name, id: s._id })));
          
          const salesman = await InternalUser.findOne({ name: req.body.salesman });
          if (salesman) {
            updateData.assignedSalesman = salesman._id;
            console.log('📝 Mapped salesman to assignedSalesman ObjectId:', req.body.salesman, '→', salesman._id);
          } else {
            console.log('⚠️ Salesman not found in InternalUser collection:', req.body.salesman);
            console.log('💡 Available salesmen names:', allSalesmen.map(s => s.name));
            console.log('ℹ️ Skipping assignedSalesman mapping - salesman not found');
          }
        } catch (error) {
          console.log('⚠️ Error finding salesman:', error.message);
          console.log('ℹ️ Skipping assignedSalesman mapping due to error');
        }
        delete updateData.salesman;
      }
      
      // ✅ NUEVA LÓGICA: Manejo completo de assignedSalesman
      console.log('�� DEBUG - Processing assignedSalesman field...');
      console.log('🔍 DEBUG - req.body.assignedSalesman:', req.body.assignedSalesman);
      console.log('🔍 DEBUG - req.body.salesman:', req.body.salesman);

      // ✅ PASO 1: Determinar el valor del vendedor
      const salesmanValue = req.body.assignedSalesman || req.body.salesman;
      console.log('🔍 DEBUG - Final salesman value:', salesmanValue);

      // ✅ PASO 2: Procesar según el valor - SIMPLIFICADO
      if (salesmanValue && typeof salesmanValue === 'string' && salesmanValue.trim() !== '') {
        // ✅ CASO: Valor válido - buscar vendedor
        try {
          console.log('🔍 Searching for assignedSalesman:', salesmanValue);
          
          const salesman = await InternalUser.findOne({ name: salesmanValue });
          if (salesman) {
            updateData.assignedSalesman = salesman._id;
            console.log('📝 Mapped assignedSalesman to ObjectId:', salesmanValue, '→', salesman._id);
          } else {
            console.log('⚠️ AssignedSalesman not found:', salesmanValue);
            return res.status(400).json({
              success: false,
              message: `El vendedor "${salesmanValue}" no se ha autenticado en la aplicación aún.`,
              errorCode: 'SALESMAN_NOT_FOUND'
            });
          }
        } catch (error) {
          console.log('⚠️ Error finding assignedSalesman:', error.message);
          return res.status(500).json({
            success: false,
            message: 'Error al buscar el vendedor asignado',
            errorCode: 'SALESMAN_SEARCH_ERROR'
          });
        }
      } else {
        // ✅ CASO: undefined, null, '', 'Select assigned salesman', o cualquier otro valor → null
        console.log('ℹ️ AssignedSalesman is empty/undefined/invalid, setting to null');
        updateData.assignedSalesman = null;
      }

      // ✅ PASO 3: Limpiar campos temporales
      delete updateData.salesman;
      
      console.log('🔍 DEBUG - Final update data:', updateData);
      
      const updatedUser = await ClientUser.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('assignedSalesman', 'name email'); // ✅ AGREGAR populate

      // ✅ PASO 3: Si está sincronizado, actualizar automáticamente en Odoo
      if (updatedUser.syncStatus === 'synced' && updatedUser.odooPartnerId) {
        console.log(' Contact is synced, updating Odoo automatically...');
        
        try {
          const odooSessionId = req.odooSessionId;
          const tenantRexUrl = req.tenantRexUrl; 
          
          if (odooSessionId && tenantRexUrl) {
            console.log('✅ Odoo session ID available:', odooSessionId);
            console.log('✅ Tenant Rex URL available:', tenantRexUrl);
            
            // ✅ CAMBIO 4: Crear instancia de OdooService con tenantRexUrl
            const odooService = new OdooService(tenantRexUrl);
            
            // ✅ Preparar datos para Odoo
            const odooUpdateData = {};
            
            // ✅ Mapear campos básicos del contacto
            if (req.body.name && req.body.name !== currentUser.name) {
              odooUpdateData.name = req.body.name;
              console.log('📝 Name changed:', currentUser.name, '→', req.body.name);
            }
            if (req.body.email && req.body.email !== currentUser.email) {
              odooUpdateData.email = req.body.email;
              console.log('📝 Email changed:', currentUser.email, '→', req.body.email);
            }
            if (req.body.whatsappPhoneNumber && req.body.whatsappPhoneNumber !== currentUser.whatsappPhoneNumber) {
              odooUpdateData.phone = req.body.whatsappPhoneNumber;
              console.log('📝 Phone changed:', currentUser.whatsappPhoneNumber, '→', req.body.whatsappPhoneNumber);
            }
            if (req.body.instagramId && req.body.instagramId !== currentUser.instagramId) {
              odooUpdateData.instagram_id = req.body.instagramId;
              console.log('📝 Instagram ID changed:', currentUser.instagramId, '→', req.body.instagramId);
            }

            console.log('🔍 DEBUG - Odoo update data prepared:', odooUpdateData);

            // ✅ CORRECCIÓN: Declarar crmUpdateData ANTES de usarlo
            const crmUpdateData = {
              name: req.body.name
            };

            // ✅ NUEVA LÓGICA: Manejo inteligente de observaciones
            if (req.body.observations !== undefined && req.body.observations !== currentUser.observations) {
              console.log('📝 Observations changed, analyzing diff...');
              console.log('📝 Previous observations:', currentUser.observations);
              console.log('📝 New observations:', req.body.observations);
              
              // Obtener observaciones actuales de Odoo
              let odooObservations = '';
              if (updatedUser.odooLeadId) {
                try {
                  const existingOpportunity = await odooService.searchOpportunityByPartner(odooSessionId, updatedUser.odooPartnerId);
                  if (existingOpportunity && existingOpportunity.description) {
                    odooObservations = existingOpportunity.description;
                    console.log('📝 Current Odoo observations:', odooObservations);
                  }
                } catch (error) {
                  console.log('⚠️ Could not fetch current Odoo observations:', error.message);
                }
              }
              
              // ✅ CORRECCIÓN: Convertir saltos de línea a HTML para Odoo
              const observationsForOdoo = req.body.observations
                .split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => `<p>${line}</p>`)
                .join('');
              
              console.log('📝 Observations formatted for Odoo:', observationsForOdoo);
              crmUpdateData.description = observationsForOdoo;
            }

            // ✅ Actualizar contacto en Odoo si hay cambios
            if (Object.keys(odooUpdateData).length > 0) {
              console.log('🔄 Updating Odoo contact:', odooUpdateData);
              await odooService.updatePartner(odooSessionId, updatedUser.odooPartnerId, odooUpdateData);
            }

            // ✅ Actualizar lead en Odoo si hay cambios
            if (updatedUser.odooLeadId && Object.keys(crmUpdateData).length > 0) {
              console.log('🔄 Updating Odoo lead:', crmUpdateData);
              
              // ✅ NUEVO: Si hay crmStage, convertir a stage_id
              if (req.body.crmStage && req.body.crmStage !== currentUser.crmStage) {
                console.log('📝 CRM Stage changed:', currentUser.crmStage, '→', req.body.crmStage);
                const stages = await odooService.getCrmStages(odooSessionId);
                const stage = stages.find(s => s.name === req.body.crmStage);
                if (stage) {
                  crmUpdateData.stage_id = stage.id;
                  console.log(`✅ Updating CRM stage to: ${req.body.crmStage} (ID: ${stage.id})`);
                }
              }
              
              // ✅ NUEVO: Manejo de assignedSalesman en Odoo - USAR LA MISMA LÓGICA
              const salesmanValue = req.body.assignedSalesman || req.body.salesman;
              const currentSalesman = currentUser.assignedSalesman;

              if (salesmanValue !== currentSalesman) {
                console.log(' Assigned Salesman changed:', currentSalesman, '→', salesmanValue);
                
                if (salesmanValue && typeof salesmanValue === 'string' && salesmanValue.trim() !== '') {
                  try {
                    const salesmen = await odooService.getSalesmen(odooSessionId);
                    const salesman = salesmen.find(s => s.name === salesmanValue);
                    if (salesman) {
                      crmUpdateData.user_id = salesman.id; // ← ID numérico
                      console.log(`✅ Updating assigned salesman to: ${salesmanValue} (ID: ${salesman.id})`);
                    } else {
                      console.log(`⚠️ Salesman not found in Odoo: ${salesmanValue}`);
                    }
                  } catch (error) {
                    console.log('⚠️ Could not fetch salesmen from Odoo:', error.message);
                  }
                } else {
                  // ✅ Cualquier valor vacío/inválido → remover vendedor en Odoo
                  crmUpdateData.user_id = null; // ← Cambiar de false a null
                  console.log('✅ Removing assigned salesman in Odoo (user_id: null)');
                }
              }
              
              // Antes de enviar a Odoo
              console.log('🔍 DEBUG - crmUpdateData antes de enviar a Odoo:', crmUpdateData);
              await odooService.updateLead(odooSessionId, updatedUser.odooLeadId, crmUpdateData);
            }

            // ✅ Registrar en historial
            const allFieldsUpdated = [...Object.keys(odooUpdateData), ...Object.keys(crmUpdateData)];
            if (allFieldsUpdated.length > 0) {
              console.log('📝 Recording sync history for fields:', allFieldsUpdated);
              updatedUser.syncHistory.push({
                action: 'update',
                timestamp: new Date(),
                odooModel: 'res.partner',
                odooId: updatedUser.odooPartnerId,
                status: 'success',
                fieldsUpdated: allFieldsUpdated
              });
              await updatedUser.save();
              console.log('✅ Sync history recorded');
            }

            console.log('✅ Odoo sync completed automatically');
          } else {
            console.log('⚠️ No Odoo session or tenant URL available - cannot sync to Odoo');
            console.log('🔍 DEBUG - Missing requirements:');
            console.log('  - odooSessionId:', !!odooSessionId);
            console.log('  - tenantRexUrl:', !!tenantRexUrl);
          }
        } catch (odooError) {
          console.error('❌ Odoo sync failed:', odooError);
          console.error('❌ Odoo error details:', {
            message: odooError.message,
            stack: odooError.stack,
            name: odooError.name
          });
          
          // ✅ Registrar error pero no fallar la actualización
          updatedUser.syncHistory.push({
            action: 'update',
            timestamp: new Date(),
            odooModel: 'res.partner',
            odooId: updatedUser.odooPartnerId,
            status: 'error',
            error: odooError.message
          });
          updatedUser.syncStatus = 'error';
          await updatedUser.save();
          console.log('❌ Error recorded in sync history');
        }
      } else {
        console.log('ℹ️ Contact not synced, only updating local data');
        console.log('🔍 DEBUG - Sync conditions not met:');
        console.log('  - syncStatus:', updatedUser.syncStatus, '(expected: "synced")');
        console.log('  - odooPartnerId:', updatedUser.odooPartnerId, '(expected: truthy)');
        console.log('  - odooSessionId:', req.odooSessionId, '(expected: truthy)');
        console.log('  - tenantRexUrl:', req.tenantRexUrl, '(expected: truthy)'); // ✅ CAMBIO 5: Log tenant URL
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('❌ Error in user update:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Lookup contact by platform identifier
   * POST /api/users/lookup
   * Body: { platform: "whatsapp", value: "543424675150" }
   */
  async lookupContact(req, res) {
    try {
      // Handle GET request with query parameters (for backward compatibility)
      if (req.method === 'GET') {
        const { instagramId, whatsappPhoneNumber, email, ids } = req.query;
        
        if (ids) {
          const idArray = ids.split(',');
          const users = await ClientUser.find({ _id: { $in: idArray } });
          return res.json(users);
        }

        // Armar el query dinámicamente con todos los campos presentes
        const query = {};
        if (instagramId) query.instagramId = instagramId;
        if (whatsappPhoneNumber) query.whatsappPhoneNumber = whatsappPhoneNumber;
        if (email) query.email = email;

        // Si no hay ningún parámetro, devolver error
        if (Object.keys(query).length === 0) {
          return res.status(400).json({ error: 'At least one lookup parameter is required' });
        }

        const user = await ClientUser.findOne(query);
        
        if (!user) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json(user);
      }

      // Handle POST request with body parameters (for frontend lookup)
      if (req.method === 'POST') {
        const { platform, value } = req.body;
        
        if (!platform || !value) {
          return res.status(400).json({ error: 'Platform and value are required' });
        }

        const query = {};
        if (platform === 'whatsapp') {
          query.whatsappPhoneNumber = value;
        } else if (platform === 'instagram') {
          query.instagramId = value;
        } else if (platform === 'email') {
          query.email = value;
        } else {
          return res.status(400).json({ error: 'Invalid platform. Use: whatsapp, instagram, or email' });
        }

        const user = await ClientUser.findOne(query);
        
        if (!user) {
          return res.json({ exists: false });
        }

        return res.json({
          exists: true,
          id: user._id,
          name: user.name,
          platform: platform,
          created_at: user.createdAt,
          contact: user
        });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async mergeContacts(req, res) {
    try {
      const { fromContactId, toContactId } = req.body;

      // 🔒 SAFETY CHECKS
      if (!fromContactId || !toContactId) {
        return res.status(400).json({ message: 'Both contact IDs required' });
      }
      
      if (fromContactId === toContactId) {
        return res.status(400).json({ message: 'Cannot merge contact with itself' });
      }

      // 📋 GET BOTH CONTACTS
      // fromContactId is the duplicate
      // toContactId is the target
      const [fromContact, toContact] = await Promise.all([
        ClientUser.findById(fromContactId),  // The duplicate
        ClientUser.findById(toContactId)     // The target
      ]);

      if (!fromContact || !toContact) {
        return res.status(404).json({ 
          error: 'One or both contacts not found' 
        });
      }

      console.log(`🔄 Starting enhanced merge: ${fromContact.name} (${fromContactId}) → ${toContact.name} (${toContactId})`);

      // 🔍 STEP 1: FIND ALL CONVERSATIONS FOR BOTH CONTACTS
      const allConversations = await Conversation.find({
        $or: [
          { participants: fromContactId },
          { participants: toContactId }
        ]
      });

      console.log(`📋 Found ${allConversations.length} total conversations to analyze`);

      // ✅ 1. ARREGLAR: Declarar conversationsByChannel fuera para que esté en scope
      let conversationsByChannel = {};
      let totalConversationsConsolidated = 0;
      let totalMessagesReassigned = 0;

      if (allConversations.length > 0) {
        // 🗂️ STEP 2: GROUP CONVERSATIONS BY CHANNEL
        conversationsByChannel = groupByChannel(allConversations);

        // 🔄 STEP 3: CONSOLIDATE CONVERSATIONS FOR EACH CHANNEL
        for (const [channel, conversations] of Object.entries(conversationsByChannel)) {
          console.log(`\n📱 Processing ${channel} channel with ${conversations.length} conversations`);

          // Filter conversations that involve both contacts (potential duplicates)
          const relevantConversations = conversations.filter(conv => {
            const participantIds = conv.participants.map(p => p.toString());
            return participantIds.includes(fromContactId) || participantIds.includes(toContactId);
          });

          if (relevantConversations.length <= 1) {
            console.log(`   ✅ ${channel}: Only 1 conversation, no consolidation needed`);
            
            // ✅ 2. ARREGLAR: Usar participantIds en lugar de participants directamente
            if (relevantConversations.length === 1) {
              const conv = relevantConversations[0];
              const participantIds = conv.participants.map(p => p.toString());
              if (participantIds.includes(fromContactId)) {
                await Conversation.updateOne(
                  { _id: conv._id },
                  { $set: { "participants.$[elem]": toContactId } },
                  { arrayFilters: [{ "elem": fromContactId }] }
                );
                console.log(`   🔄 Updated participants for ${channel} conversation`);
              }
            }
            continue;
          }

          // 🎯 SELECT CANONICAL CONVERSATION
          const { canonical, duplicates } = selectCanonicalConversation(relevantConversations);
          
          console.log(`   🎯 ${channel}: Canonical conversation: ${canonical._id}`);
          console.log(`   🗑️ ${channel}: Duplicate conversations: ${duplicates.map(d => d._id).join(', ')}`);

          // 🔄 STEP 4: REASSIGN ALL MESSAGES TO CANONICAL CONVERSATION
          for (const duplicate of duplicates) {
            const messagesReassigned = await Message.updateMany(
              { conversation: duplicate._id },
              { $set: { conversation: canonical._id } }
            );
            
            totalMessagesReassigned += messagesReassigned.modifiedCount;
            console.log(`   📨 Moved ${messagesReassigned.modifiedCount} messages from ${duplicate._id} to ${canonical._id}`);
          }

          // 🔄 STEP 5: UPDATE CANONICAL CONVERSATION PARTICIPANTS
          await Conversation.updateOne(
            { _id: canonical._id },
            { $set: { "participants.$[elem]": toContactId } },
            { arrayFilters: [{ "elem": fromContactId }] }
          );

          // 🗑️ STEP 6: DELETE DUPLICATE CONVERSATIONS
          const duplicateIds = duplicates.map(d => d._id);
          if (duplicateIds.length > 0) {
            await Conversation.deleteMany({ _id: { $in: duplicateIds } });
            totalConversationsConsolidated += duplicateIds.length;
            console.log(`   🗑️ Deleted ${duplicateIds.length} duplicate ${channel} conversations`);
          }
        }
      }

      // 🔄 STEP 7: UPDATE ANY REMAINING MESSAGES FROM fromContact TO toContact
      const remainingMessagesUpdated = await Message.updateMany(
        { sender: fromContactId },
        { $set: { sender: toContactId } }
      );

      console.log(`💬 Updated ${remainingMessagesUpdated.modifiedCount} message senders`);

      // 🧩 STEP 8: INTELLIGENT DATA MERGE
      const mergedData = {
        name: toContact.name || fromContact.name,  // Keep best name
        email: toContact.email || fromContact.email,  // Keep any email
        whatsappPhoneNumber: toContact.whatsappPhoneNumber || fromContact.whatsappPhoneNumber,
        instagramId: toContact.instagramId || fromContact.instagramId,
        crmStage: toContact.crmStage || fromContact.crmStage,
        preferences: {
          language: toContact.preferences?.language || fromContact.preferences?.language || 'es',
          notifications: toContact.preferences?.notifications !== undefined ? 
            toContact.preferences.notifications : 
            (fromContact.preferences?.notifications !== undefined ? fromContact.preferences.notifications : true)
        }
      };

      // ✅ STEP 9: UPDATE TARGET CONTACT WITH MERGED DATA
      const updatedContact = await ClientUser.findByIdAndUpdate(
        toContactId,
        mergedData,
        { new: true }
      ).populate('assignedSalesman', 'name email'); // ✅ AGREGAR populate

      // 🗑️ STEP 10: SOFT DELETE DUPLICATE (PRESERVE FOR RECOVERY)
      await ClientUser.findByIdAndUpdate(fromContactId, { 
        status: 'inactive',
        name: `[MERGED] ${fromContact.name}`,
        email: null,
        whatsappPhoneNumber: null,
        instagramId: null
      });

      // 📊 ENHANCED RESPONSE WITH CONSOLIDATION STATS
      res.json({
        success: true,
        message: 'Contacts merged and conversations consolidated successfully',
        mergedContact: updatedContact,
        stats: {
          conversationsConsolidated: totalConversationsConsolidated,
          messagesReassigned: totalMessagesReassigned,
          messageSendersUpdated: remainingMessagesUpdated.modifiedCount,
          channelsProcessed: Object.keys(conversationsByChannel).length
        }
      });

    } catch (error) {
      console.error('Error in enhanced merge:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
};

module.exports = userController;

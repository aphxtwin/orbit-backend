const OdooService = require("../service/odooService"); // ✅ CAMBIO 1: Importar clase OdooService
const { ClientUser, InternalUser } = require('../models');

async function testLogin(req, res) {
  // NO ESTA ACTUALIZADO PARA LA LOGICA DE MULTITENANT
  try {
    const version = await odooService.loginOdoo();
    res.json({ success: true, version });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getPartnersHandler(req, res) {
  try {
    //  Obtener tenantRexUrl del request
    const tenantRexUrl = req.tenantRexUrl;
    const odooSessionId = req.odooSessionId;
    
    console.log('🔑 Using Odoo session ID:', odooSessionId);
    console.log('🔑 Using Tenant URL:', tenantRexUrl);
    
    if (!odooSessionId) {
      return res.status(401).json({ success: false, message: 'No Odoo session available' });
    }
    
    if (!tenantRexUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant URL not available' 
      });
    }
    
    // ✅ Crear instancia de OdooService con tenantRexUrl
    const odooService = new OdooService(tenantRexUrl);
    
    const partners = await odooService.getPartners(odooSessionId);
    console.log(partners, 'partners')

    res.json({ success: true, data: partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createPartnerHandler(req, res) {
  try {
    // ✅ DEBUG: Log completo del req.body para ver qué se está enviando
    console.log('🔍 Full req.body received:', JSON.stringify(req.body, null, 2));
    
    const { name, email, phone, type, customer_rank, crmStage, clientUserId, instagramId, observations, assignedSalesman } = req.body;
    const odooSessionId = req.odooSessionId;
    const tenantRexUrl = req.tenantRexUrl; 
    
    // ✅ DEBUG: Log específico del assignedSalesman
    console.log('👤 assignedSalesman from req.body:', assignedSalesman);
    console.log('👤 Type of assignedSalesman:', typeof assignedSalesman);
    
    if (!odooSessionId) {
      console.error('❌ No Odoo session ID available');
      return res.status(401).json({ success: false, message: 'No Odoo session available' });
    }
    
    if (!tenantRexUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant URL not available' 
      });
    }
    
    // ✅  Crear instancia de OdooService con tenantRexUrl
    const odooService = new OdooService(tenantRexUrl);
    
    // ✅ NUEVO: Verificar que existe clientUserId
    if (!clientUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'clientUserId is required' 
      });
    }
    
    // ✅ NUEVO: Obtener el ClientUser para obtener su _id de MongoDB
    console.log('🔍 Looking for ClientUser:', clientUserId);
    const clientUser = await ClientUser.findById(clientUserId);
    if (!clientUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'ClientUser not found' 
      });
    }
    
    console.log('✅ ClientUser found:', clientUser._id);
    console.log('🔄 Processing contact export:', { name, email, phone, type, customer_rank, crmStage, observations });
    
    // ✅ NUEVO: Obtener observations del clientUser si no se proporcionó en el body
    const finalObservations = observations || clientUser.observations || '';
    console.log('📝 Observations to include in CRM:', finalObservations);
    
    // ✅ VERIFICACIÓN: Buscar si ya existe en Odoo
    console.log('🔍 Checking if contact already exists in Odoo...');
    console.log('📊 Search criteria:', { email, phone, instagramId }); // ← AGREGAR ESTE LOG

    const existingContact = await odooService.searchContactByCriteria(odooSessionId, {
      email: email,
      phone: phone,
      instagramId: instagramId  // ← Este campo se mapea a 'instagram_id' en Odoo
    });
    
    if (existingContact) {
      console.log('⚠️ Contact already exists in Odoo:', existingContact);
      
      // ✅ NUEVA LÓGICA: Verificar estado de sincronización
      if (existingContact.orbit_user_id) {
        // ✅ CONTACTO YA ESTÁ SINCRONIZADO
        if (existingContact.orbit_user_id === clientUser._id.toString()) {
          // ✅ Es el mismo usuario - RETORNAR OPCIONES
          console.log('🔄 Contact already synchronized with this user - returning options');
          
          return res.json({ 
            success: false, 
            message: 'Contact already synchronized with this user',
            action: 'already_synced_with_this_user',
            options: [
              'update_info',      // ← Opción para actualizar información
              'keep_existing'     // ← Opción para mantener como está
            ],
            existingContact: {
              id: existingContact.id,
              name: existingContact.name,
              email: existingContact.email,
              phone: existingContact.phone,
              orbit_user_id: existingContact.orbit_user_id,
              instagram_id: existingContact.instagram_id  // ← AGREGAR ESTE CAMPO
            },
            suggestedData: {      // ← Datos sugeridos para actualización
              name,
              email,
              phone,
              type,
              customer_rank,
              observations: finalObservations  
            },
            clientUserId: clientUserId,
            orbitUserId: clientUser._id.toString()
          });
          
        } else {
          // ❌ Está sincronizado con OTRO usuario
          console.log('❌ Contact synchronized with another user - operation blocked');
          
          return res.status(409).json({ 
            success: false, 
            message: 'Contact already exists and is synchronized with another user',
            action: 'already_synced_with_other',
            existingContact: {
              id: existingContact.id,
              name: existingContact.name,
              email: existingContact.email,
              phone: existingContact.phone,
              orbit_user_id: existingContact.orbit_user_id,
              instagram_id: existingContact.instagram_id  // ← AGREGAR ESTE CAMPO
            }
          });
        }
      } else {
        // ✅ CONTACTO EXISTE PERO NO ESTÁ SINCRONIZADO (caso presencial)
        console.log('🔄 Contact exists but not synchronized - returning sync options');
        
        return res.json({ 
          success: false, 
          message: 'Contact exists in Odoo but not synchronized',
          action: 'exists_not_synced',
          options: [
            'sync_presential',    // ← Opción para sincronizar contacto presencial
            'no_sync'             // ← Opción para no sincronizar
          ],
          existingContact: {
            id: existingContact.id,
            name: existingContact.name,
            email: existingContact.email,
            phone: existingContact.phone,
            instagram_id: existingContact.instagram_id  // ← AGREGAR ESTE CAMPO
          },
          suggestedData: {        // ← Datos sugeridos para sincronización
            name,
            email,
            phone,
            type,
            customer_rank,
            observations: finalObservations  
          },
          clientUserId: clientUserId,
          orbitUserId: clientUser._id.toString()
        });
      }
    }
    
    console.log('✅ No duplicate found, proceeding with creation...');
    
    // 1. Crear el contacto
    const partnerData = {
      name,
      email,
      phone,
      type,
      customer_rank,
      instagram_id: instagramId,
    };

    console.log('📊 Partner data to create:', partnerData); // ← AGREGAR ESTE LOG
    console.log('📊 Instagram ID value:', instagramId); // ← AGREGAR ESTE LOG
    console.log('🔍 Instagram ID type:', typeof instagramId); // ← AGREGAR ESTE LOG
    
    const newPartnerId = await odooService.createPartner(odooSessionId, partnerData);
    console.log('✅ Partner created with ID:', newPartnerId);
    
    // ✅ NUEVO: Actualizar campos de sincronización
    console.log('🔄 Updating Orbit synchronization fields...');
    await odooService.updateOdooSyncFields(
      odooSessionId, 
      newPartnerId, 
      clientUser._id.toString(),  // ← ID de MongoDB como orbit_user_id
      'synced'
    );
    console.log('✅ Orbit fields updated successfully');
    
    // ✅ NUEVO: Actualizar ClientUser con odooPartnerId
    await ClientUser.findByIdAndUpdate(clientUserId, {
      odooPartnerId: newPartnerId,
      syncStatus: 'synced'
    });
    console.log('✅ ClientUser updated with odooPartnerId');
    
    // 2. Si hay etapa CRM, crear la oportunidad
    let leadId = null;
    if (crmStage) {
      console.log('🔄 Looking for CRM stage:', crmStage);
      
      const allStages = await odooService.getCrmStages(odooSessionId);
      console.log('📊 All available stages:', allStages);
      
      const stage = allStages.find(s => s.name === crmStage);
      
      if (stage) {
        console.log('✅ Found CRM stage:', stage);
        
        const opportunityData = {
          name: `Oportunidad - ${name}`,
          partner_id: newPartnerId,
          stage_id: stage.id,
          type: 'opportunity',
          description: finalObservations || '',  
        };
        
        // ✅ CORRECCIÓN: Buscar el odooUserId del vendedor asignado
        if (assignedSalesman && assignedSalesman !== null && assignedSalesman !== undefined) {
          let salesmanId = assignedSalesman;
          
          // ✅ NUEVO: Si assignedSalesman es un objeto, extraer el _id
          if (typeof assignedSalesman === 'object' && assignedSalesman._id) {
            salesmanId = assignedSalesman._id;
            console.log('👤 Extracted salesman ID from object:', salesmanId);
          } else if (typeof assignedSalesman === 'string') {
            salesmanId = assignedSalesman;
            console.log('👤 Using salesman ID as string:', salesmanId);
          }
          
          console.log('👤 Looking for assigned salesman odooUserId:', salesmanId);
          
          try {
            const assignedSalesmanUser = await InternalUser.findById(salesmanId);
            
            if (assignedSalesmanUser && assignedSalesmanUser.odooUserId) {
              console.log('✅ Found assigned salesman odooUserId:', assignedSalesmanUser.odooUserId);
              opportunityData.user_id = assignedSalesmanUser.odooUserId;
            } else {
              console.log('⚠️ Assigned salesman not found or has no odooUserId, skipping user assignment');
              console.log('🔍 Searched for salesmanId:', salesmanId);
              console.log(' Found user:', assignedSalesmanUser);
            }
          } catch (salesmanError) {
            console.error('❌ Error finding assigned salesman:', salesmanError);
            console.log('⚠️ Skipping user assignment due to error');
          }
        } else {
          console.log('⚠️ No assignedSalesman provided or is null/undefined - CRM Lead will be created without user_id');
          // ✅ NUEVO: Romper la lógica de Odoo - establecer user_id como false para evitar asignación automática
          opportunityData.user_id = null;
        }
        
        console.log('🔄 Creating opportunity with data:', opportunityData);
        console.log('📝 Opportunity description (observations):', finalObservations);
        try {
          leadId = await odooService.createCrmLead(odooSessionId, opportunityData);
          console.log('✅ Opportunity created with ID:', leadId);
          
          // ✅ NUEVO: Actualizar ClientUser con odooLeadId
          await ClientUser.findByIdAndUpdate(clientUserId, {
            odooLeadId: leadId
          });
          console.log('✅ ClientUser updated with odooLeadId');
          
        } catch (opportunityError) {
          console.error('❌ Error creating opportunity:', opportunityError);
        }
      } else {
        console.log('⚠️ CRM stage not found:', crmStage);
        console.log('Available stages:', allStages.map(s => s.name));
      }
    } else {
      console.log('⚠️ No CRM stage provided');
    }
    
    console.log('🚀 ===== EXPORT CONTACT COMPLETED =====');
    res.json({ 
      success: true, 
      partner_id: newPartnerId,
      lead_id: leadId,
      orbit_user_id: clientUser._id.toString(),
      action: 'created_new',
      observations_included: !!finalObservations  
    });
    
  } catch (err) {
    console.error('❌ Error in createPartnerHandler:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ✅ NUEVO MÉTODO: Para cuando el usuario elige "Sincronizar"
async function syncExistingContactHandler(req, res) {
  try {
    const { 
      odooPartnerId, 
      name, 
      email, 
      phone, 
      crmStage, 
      type,
      customer_rank,
      assignedSalesman, 
      instagramId,
      clientUserId,
      observations  
    } = req.body;
    
    const odooSessionId = req.odooSessionId;
    const tenantRexUrl = req.tenantRexUrl; 
    
    if (!odooSessionId) {
      return res.status(401).json({ 
        success: false, 
        message: 'No Odoo session available' 
      });
    }
    
    if (!tenantRexUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant URL not available' 
      });
    }
    
    // ✅ Crear instancia de OdooService con tenantRexUrl
    const odooService = new OdooService(tenantRexUrl);
    
    // ✅ Obtener ClientUser
    const clientUser = await ClientUser.findById(clientUserId);
    if (!clientUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'ClientUser not found' 
      });
    }
    
    // ✅ NUEVO: Obtener datos actuales del contacto en Odoo
    console.log(' Fetching current Odoo contact data...');
    const currentOdooContact = await odooService.getPartner(odooSessionId, odooPartnerId);
    
    if (!currentOdooContact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Odoo contact not found' 
      });
    }
    
    console.log('📊 Current Odoo data:', currentOdooContact);
    console.log(' App data:', { name, email, phone, crmStage, assignedSalesman, instagramId, observations });
    
    // ✅ NUEVA LÓGICA: Obtener información CRM de oportunidad existente
    let odooCrmStage = null;
    let odooSalesman = null;
    let odooObservations = null; 
    let existingOpportunity = null;

    existingOpportunity = await odooService.searchOpportunityByPartner(odooSessionId, odooPartnerId);

    if (existingOpportunity) {
      console.log('✅ Found existing opportunity in Odoo:', existingOpportunity);
      
      // ✅ CORRECCIÓN: Extraer stage_id del array [id, name]
      if (existingOpportunity.stage_id && Array.isArray(existingOpportunity.stage_id)) {
        const stageId = existingOpportunity.stage_id[0]; // ← Primer elemento es el ID
        const stageName = existingOpportunity.stage_id[1]; // ← Segundo elemento es el nombre
        
        console.log('📊 Odoo CRM Stage ID:', stageId);
        console.log('📊 Odoo CRM Stage Name:', stageName);
        
        odooCrmStage = stageName; // ← Usar el nombre directamente
      }
      
      // ✅ CORRECCIÓN: Extraer user_id del array [id, name]
      if (existingOpportunity.user_id && Array.isArray(existingOpportunity.user_id)) {
        const userId = existingOpportunity.user_id[0]; // ← Primer elemento es el ID
        const userName = existingOpportunity.user_id[1]; // ← Segundo elemento es el nombre
        
        console.log('👤 Odoo Salesman ID:', userId);
        console.log(' Odoo Salesman Name:', userName);
        
        odooSalesman = userName; // ← Usar el nombre directamente
      } else if (existingOpportunity.user_id === false || existingOpportunity.user_id === null) {
        // ✅ NUEVO: Manejar caso cuando user_id es null/false en Odoo
        console.log('👤 Odoo CRM Lead has no assigned salesman (user_id is null/false)');
        console.log(' Setting odooSalesman to null');
        odooSalesman = null; // ← Establecer explícitamente como null
      } else {
        console.log('👤 Odoo CRM Lead user_id format not recognized:', existingOpportunity.user_id);
        console.log('👤 Setting odooSalesman to null as fallback');
        odooSalesman = null; // ← Fallback a null
      }
      
      // ✅ NUEVO: Extraer observaciones de la oportunidad existente
      if (existingOpportunity.description) {
        odooObservations = existingOpportunity.description;
        console.log('📝 Odoo observations (description):', odooObservations);
      } else {
        console.log('ℹ️ No observations found in Odoo opportunity');
      }
    } else {
      console.log('ℹ️ No existing opportunity found in Odoo');
      
      // ✅ NUEVA LÓGICA: Crear oportunidad si no existe y se proporcionó crmStage
      if (crmStage) {
        console.log('🔄 Creating new opportunity with CRM stage:', crmStage);
        
        try {
          const allStages = await odooService.getCrmStages(odooSessionId);
          const stage = allStages.find(s => s.name === crmStage);
          
          if (stage) {
            console.log('✅ Found CRM stage:', stage);
            
            const opportunityData = {
              name: `Oportunidad - ${name}`,
              partner_id: odooPartnerId,
              stage_id: stage.id,
              type: 'opportunity',
              description: observations || clientUser.observations || '',  
            };
            
            // ✅ CORRECCIÓN: Buscar el odooUserId del vendedor asignado
            if (assignedSalesman && assignedSalesman !== null && assignedSalesman !== undefined) {
              let salesmanId = assignedSalesman;
              
              // ✅ NUEVO: Si assignedSalesman es un objeto, extraer el _id
              if (typeof assignedSalesman === 'object' && assignedSalesman._id) {
                salesmanId = assignedSalesman._id;
                console.log('�� Extracted salesman ID from object:', salesmanId);
              } else if (typeof assignedSalesman === 'string') {
                salesmanId = assignedSalesman;
                console.log('👤 Using salesman ID as string:', salesmanId);
              }
              
              console.log('👤 Looking for assigned salesman odooUserId:', salesmanId);
              
              try {
                // ✅ CORRECCIÓN: Buscar en InternalUser en lugar de ClientUser
                const assignedSalesmanUser = await InternalUser.findById(salesmanId);
                
                if (assignedSalesmanUser && assignedSalesmanUser.odooUserId) {
                  console.log('✅ Found assigned salesman odooUserId:', assignedSalesmanUser.odooUserId);
                  opportunityData.user_id = assignedSalesmanUser.odooUserId;
                } else {
                  console.log('⚠️ Assigned salesman not found or has no odooUserId, skipping user assignment');
                }
              } catch (salesmanError) {
                console.error('❌ Error finding assigned salesman:', salesmanError);
                console.log('⚠️ Skipping user assignment due to error');
              }
            } else {
              console.log('⚠️ No assignedSalesman provided or is null/undefined - CRM Lead will be created without user_id');
              // ✅ NUEVO: Romper la lógica de Odoo - establecer user_id como false para evitar asignación automática
              opportunityData.user_id = null;
            }
            
            console.log('🔄 Creating opportunity with data:', opportunityData);
            const newLeadId = await odooService.createCrmLead(odooSessionId, opportunityData);
            console.log('✅ New opportunity created with ID:', newLeadId);
            
            // ✅ NUEVO: Actualizar existingOpportunity con la nueva oportunidad creada
            existingOpportunity = {
              id: newLeadId,
              stage_id: [stage.id, stage.name],
              description: opportunityData.description
            };
            
            // ✅ NUEVO: Actualizar odooCrmStage con el stage de la app
            odooCrmStage = crmStage;
            
            console.log('✅ New opportunity data:', existingOpportunity);
          } else {
            console.log('⚠️ CRM stage not found:', crmStage);
            console.log('Available stages:', allStages.map(s => s.name));
          }
        } catch (opportunityError) {
          console.error('❌ Error creating new opportunity:', opportunityError);
        }
      }
    }

    // ✅ NUEVA LÓGICA: Odoo es SIEMPRE fuente de verdad para CRM
    const finalCrmStage = odooCrmStage;  // ← Solo de Odoo (oportunidad existente)
    const finalSalesman = odooSalesman;  // ← Solo de Odoo (oportunidad existente)

    console.log('📊 CRM Data (Odoo as source of truth):');
    console.log('  - CRM Stage: Odoo=', odooCrmStage, '| Final=', finalCrmStage);
    console.log('  - Salesman: Odoo=', odooSalesman, '| Final=', finalSalesman);
    
    // ✅ NUEVA LÓGICA: Combinar observaciones de ambos sistemas
    const appObservations = observations || clientUser.observations || '';
    const finalObservations = odooService.combineObservations(odooObservations, appObservations);
    console.log('📝 Combined observations:', finalObservations);
    
    // ✅ Lógica de fusión inteligente solo para campos básicos del contacto
    // Odoo es la fuente de verdad, pero se complementa con datos de la app
    const mergedData = {
      name: currentOdooContact.name || name, // Si Odoo tiene nombre, usar ese
      email: currentOdooContact.email || email, // Si Odoo tiene email, usar ese
      phone: currentOdooContact.phone || phone, // Si Odoo tiene teléfono, usar ese
      instagram_id: currentOdooContact.instagram_id || instagramId, // Si Odoo tiene Instagram ID, usar ese
      
      // ✅ CAMPOS CRM - SOLO DE ODOO (oportunidad existente)
      crmStage: finalCrmStage,        // ← Solo de Odoo
      assignedSalesman: finalSalesman, // ← Solo de Odoo
      type: type || 'contact',
      customer_rank: customer_rank || 1,
      
      // ✅ NUEVO: Observaciones combinadas
      observations: finalObservations,
      
      // ✅ INFORMACIÓN DE LA OPORTUNIDAD EXISTENTE
      existingOpportunityId: existingOpportunity?.id || null,
      hasExistingOpportunity: !!existingOpportunity
    };
    
    // ✅ Si la app tiene información que Odoo no tiene, actualizar Odoo (solo campos básicos)
    const fieldsToUpdate = {};
    let hasUpdates = false;
    
    if (!currentOdooContact.name && name) {
      fieldsToUpdate.name = name;
      hasUpdates = true;
    }
    if (!currentOdooContact.email && email) {
      fieldsToUpdate.email = email;
      hasUpdates = true;
    }
    if (!currentOdooContact.phone && phone) {
      fieldsToUpdate.phone = phone;
      hasUpdates = true;
    }
    if (!currentOdooContact.instagram_id && instagramId) {
      fieldsToUpdate.instagram_id = instagramId;
      hasUpdates = true;
    }
    
    // ✅ Actualizar Odoo solo si hay campos nuevos de la app
    if (hasUpdates) {
      console.log(' Updating Odoo with new app data:', fieldsToUpdate);
      await odooService.updatePartner(odooSessionId, odooPartnerId, fieldsToUpdate);
    } else {
      console.log('ℹ️ No new data to update in Odoo');
    }
    
    // ✅ NUEVO: Actualizar observaciones en la oportunidad existente
    if (existingOpportunity && finalObservations) {
      console.log('📝 Updating opportunity observations:', finalObservations);
      try {
        await odooService.updateLead(odooSessionId, existingOpportunity.id, {
          description: odooService.combineObservationsForOdoo(odooObservations, appObservations)
        });
        console.log('✅ Opportunity observations updated successfully');
      } catch (error) {
        console.error('❌ Error updating opportunity observations:', error);
      }
    }
    
    // ✅ Vincular con el ClientUser actual
    await odooService.updateOdooSyncFields(
      odooSessionId, 
      odooPartnerId, 
      clientUser._id.toString(),
      'synced'
    );
    
    // ✅ Actualizar ClientUser con odooPartnerId y datos fusionados
    const updatedClientUserData = {
      odooPartnerId: odooPartnerId,
      syncStatus: 'synced'
    };
    
    // ✅ NUEVO: Agregar odooLeadId si existe oportunidad
    if (existingOpportunity) {
      updatedClientUserData.odooLeadId = existingOpportunity.id;
      console.log('✅ Adding odooLeadId to ClientUser:', existingOpportunity.id);
    }
    
    // ✅ Actualizar campos del ClientUser con datos de Odoo si es necesario
    if (currentOdooContact.name && currentOdooContact.name !== clientUser.name) {
      updatedClientUserData.name = currentOdooContact.name;
    }
    if (currentOdooContact.email && currentOdooContact.email !== clientUser.email) {
      updatedClientUserData.email = currentOdooContact.email;
    }
    if (currentOdooContact.phone && currentOdooContact.phone !== clientUser.whatsappPhoneNumber) {
      updatedClientUserData.whatsappPhoneNumber = currentOdooContact.phone;
    }
    if (currentOdooContact.instagram_id && currentOdooContact.instagram_id !== clientUser.instagramId) {
      updatedClientUserData.instagramId = currentOdooContact.instagram_id;
    }
    
    // ✅ NUEVA LÓGICA: Actualizar campos CRM - SOLO DE ODOO (oportunidad existente)
    // ✅ SIEMPRE actualizar estos campos, independientemente de su valor (incluso null)
    updatedClientUserData.crmStage = finalCrmStage;        // ← Solo de Odoo
    updatedClientUserData.assignedSalesman = finalSalesman; // ← Solo de Odoo (puede ser null)
    
    console.log('📊 CRM Fields to update in ClientUser:');
    console.log('  - crmStage:', finalCrmStage);
    console.log('  - assignedSalesman:', finalSalesman);
    console.log('  - assignedSalesman type:', typeof finalSalesman);
    console.log('  - assignedSalesman === null:', finalSalesman === null);
    console.log('  - assignedSalesman === undefined:', finalSalesman === undefined);
    
    // ✅ NO actualizar odooLeadId automáticamente (ya existe)
    // updatedClientUserData.odooLeadId = existingOpportunity?.id; // ← Opcional si quieres actualizarlo
    
    console.log('🔄 Updating ClientUser with merged data:', updatedClientUserData);
    await ClientUser.findByIdAndUpdate(clientUserId, updatedClientUserData);
    
    // ✅ NUEVO: Verificar que la actualización se haya aplicado
    const updatedClientUser = await ClientUser.findById(clientUserId);
    console.log('✅ ClientUser updated successfully');
    console.log(' Updated assignedSalesman in DB:', updatedClientUser.assignedSalesman);
    console.log(' Updated crmStage in DB:', updatedClientUser.crmStage);
    
    console.log('✅ Existing contact synchronized successfully with Odoo opportunity data');
    
    res.json({ 
      success: true, 
      message: 'Contact synchronized successfully with Odoo opportunity data',
      partner_id: odooPartnerId,
      action: 'synced_existing',
      mergedData: mergedData,
      updatedFields: Object.keys(fieldsToUpdate),
      updatedUserFields: Object.keys(updatedClientUserData).filter(key => key !== 'odooPartnerId' && key !== 'syncStatus'),
      crmStage: finalCrmStage,        // ← Solo de Odoo
      assignedSalesman: finalSalesman, // ← Solo de Odoo
      hasExistingOpportunity: !!existingOpportunity,
      existingOpportunityId: existingOpportunity?.id || null,
      observationsCombined: finalObservations,  // ✅ AGREGAR: Observaciones combinadas
      opportunityCreated: !existingOpportunity && !!crmStage  // ✅ NUEVO: Indica si se creó nueva oportunidad
    });
    
  } catch (err) {
    console.error('❌ Error in syncExistingContactHandler:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ✅ NUEVA FUNCIÓN AUXILIAR: Para combinar observaciones
function combineObservations(odooObservations, appObservations) {
  const odoo = (odooObservations || '').trim();
  const app = (appObservations || '').trim();
  
  if (!odoo && !app) {
    return '';
  }
  
  if (!odoo) {
    return app;
  }
  
  if (!app) {
    return odoo;
  }
  
  // ✅ NUEVO: Limpiar HTML de Odoo de forma completa
  const cleanOdoo = cleanHtmlFromOdoo(odoo);
  
  // ✅ Combinar ambas observaciones separadas por un salto de línea para la app
  return `${cleanOdoo}\n${app}`;
}

// ✅ NUEVA FUNCIÓN AUXILIAR: Para combinar observaciones (versión para Odoo)
function combineObservationsForOdoo(odooObservations, appObservations) {
  const odoo = (odooObservations || '').trim();
  const app = (appObservations || '').trim();
  
  if (!odoo && !app) {
    return '';
  }
  
  if (!odoo) {
    return app;
  }
  
  if (!app) {
    return odoo;
  }
  
  // ✅ NUEVO: Limpiar HTML de Odoo de forma completa
  const cleanOdoo = cleanHtmlFromOdoo(odoo);
  
  // ✅ CORRECCIÓN: Usar <p> tags para crear párrafos separados en Odoo
  return `<p>${cleanOdoo}</p><p>${app}</p>`;
}

// ✅ NUEVA FUNCIÓN AUXILIAR: Para limpiar HTML de Odoo
function cleanHtmlFromOdoo(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') {
    return '';
  }
  
  // ✅ Remover tags HTML y metadatos de Odoo
  let cleanText = htmlString
    // Remover todos los tags HTML
    .replace(/<[^>]*>/g, '')
    // Remover atributos data-last-history-steps y similares
    .replace(/data-[^=]*="[^"]*"/g, '')
    // ✅ NUEVO: Remover entidades HTML (más robusto)
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')  
    // Remover espacios múltiples
    .replace(/\s+/g, ' ')
    // Trim espacios al inicio y final
    .trim();
  
  return cleanText;
}

async function getCrmStagesHandler(req, res) {
  try {
    const tenantRexUrl = req.tenantRexUrl;
    const odooSessionId = req.odooSessionId;
    
    if (!odooSessionId) {
      return res.status(401).json({ success: false, message: 'No Odoo session available' });
    }
    
    if (!tenantRexUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant URL not available' 
      });
    }
    
    // ✅ Crear instancia de OdooService con tenantRexUrl
    const odooService = new OdooService(tenantRexUrl);
    
    const stages = await odooService.getCrmStages(odooSessionId);
    res.json({ success: true, data: stages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ✅ NUEVO HANDLER: Para obtener todos los vendedores (salesman)
async function getSalesmenHandler(req, res) {
  try {
    const tenantRexUrl = req.tenantRexUrl;
    const odooSessionId = req.odooSessionId;
    
    if (!odooSessionId) {
      return res.status(401).json({ success: false, message: 'No Odoo session available' });
    }
    
    if (!tenantRexUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant URL not available' 
      });
    }
    
    // ✅ Crear instancia de OdooService con tenantRexUrl
    const odooService = new OdooService(tenantRexUrl);
    
    const salesmen = await odooService.getSalesmen(odooSessionId);
    res.json({ success: true, data: salesmen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  testLogin,
  getPartnersHandler,
  createPartnerHandler,
  getCrmStagesHandler,
  getSalesmenHandler,  // ✅ AGREGAR: Nuevo handler
  syncExistingContactHandler,
};
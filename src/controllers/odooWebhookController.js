// controllers/odooWebhookController.js
const { ClientUser } = require('../models');
const InternalUser = require('../models/InternalUser');  // ✅ AGREGAR IMPORT
const Tenant = require('../models/Tenant');
const OdooService = require('../service/odooService');

/**
 * Procesa actualizaciones de contactos desde Odoo
 * @param {string} partner_id - ID del partner en Odoo
 * @param {string} event_type - Tipo de evento (ej: "partner.updated")
 * @param {Object} data - Datos del contacto
 * @param {Object} tenant_info - Información del tenant
 * @returns {Object} Resultado del procesamiento
 */
async function processOdooPartnerUpdate(partner_id, event_type, data, tenant_info) {
  try {
    console.log('🔄 Procesando actualización de partner desde Odoo...');
    console.log('�� Partner ID:', partner_id);
    console.log('📊 Event Type:', event_type);
    console.log('📊 Tenant Info:', tenant_info);
    console.log('�� Changes:', data.changes);

    // 1. Buscar el tenant por rex_url
    console.log('🔍 Buscando tenant por rex_url:', tenant_info.rex_url);
    const tenant = await Tenant.findOne({ rexUrl: tenant_info.rex_url });
    
    if (!tenant) {
      throw new Error(`Tenant not found for rex_url: ${tenant_info.rex_url}`);
    }
    
    console.log('✅ Tenant encontrado:', tenant._id);

    // 2. Buscar el ClientUser por orbit_user_id y tenantId
    console.log('🔍 Buscando ClientUser por orbit_user_id:', data.orbit_user_id);
    const clientUser = await ClientUser.findOne({
      _id: data.orbit_user_id,
      tenantId: tenant._id.toString()
    });

    if (!clientUser) {
      throw new Error(`ClientUser not found for orbit_user_id: ${data.orbit_user_id} in tenant: ${tenant._id}`);
    }

    console.log('✅ ClientUser encontrado:', clientUser._id);

    // 3. Validar que odooPartnerId coincida
    if (clientUser.odooPartnerId !== partner_id.toString()) {
      throw new Error(`odooPartnerId mismatch. Expected: ${partner_id}, Found: ${clientUser.odooPartnerId}`);
    }

    console.log('✅ odooPartnerId validado correctamente');

    // 4. Mapear campos de changes a ClientUser
    const fieldsToUpdate = {};
    const fieldsUpdated = [];

    // Mapeo de campos de Odoo a ClientUser
    const fieldMapping = {
      'email': 'email',
      'phone': 'whatsappPhoneNumber',
      'name': 'name',
      'stage_name': 'crmStage',
      'description': 'observations',  // ✅ NUEVO: Agregar description -> observations
      'user_id': 'assignedSalesman'  // ✅ NUEVO: Mapear user_id -> assignedSalesman
    };
    
    // Procesar solo los campos que están en changes
    for (const [odooField, clientUserField] of Object.entries(fieldMapping)) {
      if (data.changes && data.changes.hasOwnProperty(odooField)) {
        const newValue = data.changes[odooField];
        
        console.log(`🔍 Procesando campo ${odooField} -> ${clientUserField}`);
        console.log(`🔍 Nuevo valor: "${newValue}"`);
        console.log(` Valor actual en ClientUser: "${clientUser[clientUserField]}"`);
        console.log(` ¿Son diferentes?: ${newValue !== clientUser[clientUserField]}`);
        
        // Validaciones específicas por campo
        if (odooField === 'phone' && newValue === false) {
          console.log('⚠️ Phone es false, omitiendo actualización');
          continue;
        }
        
        if (odooField === 'email' && newValue && newValue !== clientUser[clientUserField]) {
          fieldsToUpdate[clientUserField] = newValue;
          fieldsUpdated.push(clientUserField);
          console.log(`📝 Campo ${clientUserField} será actualizado: ${newValue}`);
        } else if (odooField === 'phone' && newValue && newValue !== clientUser[clientUserField]) {
          fieldsToUpdate[clientUserField] = newValue;
          fieldsUpdated.push(clientUserField);
          console.log(`📝 Campo ${clientUserField} será actualizado: ${newValue}`);
        } else if (odooField === 'name' && newValue && newValue !== clientUser[clientUserField]) {
          fieldsToUpdate[clientUserField] = newValue;
          fieldsUpdated.push(clientUserField);
          console.log(`📝 Campo ${clientUserField} será actualizado: ${newValue}`);
        } else if (odooField === 'stage_name' && newValue && newValue !== clientUser[clientUserField]) {
          fieldsToUpdate[clientUserField] = newValue;
          fieldsUpdated.push(clientUserField);
          console.log(`📝 Campo ${clientUserField} será actualizado: ${newValue}`);
        } else if (odooField === 'user_id') { // ← Quitar la condición newValue &&
          console.log('📝 Procesando vendedor asignado desde Odoo:');
          console.log(' Odoo user_id:', newValue);
          
          // ✅ NUEVO: Manejar null de Odoo
          if (newValue === null || newValue === 'null' || newValue === '' || newValue === false || newValue === 0) {
            // Remover vendedor
            fieldsToUpdate[clientUserField] = null;
            fieldsUpdated.push(clientUserField);
            console.log(`📝 Campo ${clientUserField} será actualizado a null (vendedor removido)`);
          } else {
            // Buscar vendedor solo si no es null
            const internalUser = await InternalUser.findOne({
              odooUserId: newValue,
              tenantId: tenant._id.toString()
            });
            if (internalUser) {
              fieldsToUpdate[clientUserField] = internalUser._id;
              fieldsUpdated.push(clientUserField);
              console.log(`�� Campo ${clientUserField} será actualizado con vendedor: ${internalUser._id}`);
            } else {
              console.log(`⚠️ No se encontró InternalUser con odooUserId: ${newValue}`);
              // ✅ NUEVO: Si no se encuentra el vendedor, también actualizar a null
              fieldsToUpdate[clientUserField] = null;
              fieldsUpdated.push(clientUserField);
              console.log(`📝 Campo ${clientUserField} será actualizado a null (vendedor no encontrado)`);
            }
          }
        } else if (odooField === 'description' && newValue && newValue !== clientUser[clientUserField]) {
          // ✅ NUEVO: Procesar description (observaciones) desde Odoo
          const odooService = new OdooService(tenant_info.rex_url);
          
          // Limpiar HTML de Odoo
          const cleanOdooObservations = odooService.cleanHtmlFromOdoo(newValue);
          
          console.log('📝 Procesando observaciones desde Odoo:');
          console.log('📝 Odoo (cleaned):', cleanOdooObservations);
          
          // ✅ LÓGICA SIMPLE: Solo usar las observaciones de Odoo
          // Porque Odoo ya tiene las observaciones actualizadas
          const finalObservations = cleanOdooObservations;
          
          console.log('📝 Usando solo observaciones de Odoo:', finalObservations);
          
          fieldsToUpdate[clientUserField] = finalObservations;
          fieldsUpdated.push(clientUserField);
          console.log(`📝 Campo ${clientUserField} será actualizado con observaciones de Odoo`);
        } else {
          console.log(`⚠️ Campo ${odooField} no cumple condiciones para actualizar`);
        }
      }
    }

    // 5. Si no hay campos para actualizar, retornar sin cambios
    if (Object.keys(fieldsToUpdate).length === 0) {
      console.log('ℹ️ No hay campos para actualizar');
      return {
        success: true,
        message: 'No changes detected',
        partner_id,
        fieldsUpdated: [],
        action: 'no_changes'
      };
    }

    // 6. Actualizar el ClientUser
    console.log(' Actualizando ClientUser con campos:', fieldsToUpdate);
    
    const updatedClientUser = await ClientUser.findByIdAndUpdate(
      clientUser._id,
      { $set: fieldsToUpdate },
      { new: true }
    );

    // 7. Agregar entrada al historial de sincronización
    const syncHistoryEntry = {
      action: 'update',
      timestamp: new Date(),
      odooModel: 'res.partner',
      odooId: partner_id.toString(),
      status: 'success',
      fieldsUpdated: fieldsUpdated,
      changes: data.changes
    };

    await ClientUser.findByIdAndUpdate(
      clientUser._id,
      { $push: { syncHistory: syncHistoryEntry } }
    );

    console.log('✅ ClientUser actualizado exitosamente');
    console.log('📊 Campos actualizados:', fieldsUpdated);
    console.log('📊 Nuevos valores:', fieldsToUpdate);

    return {
      success: true,
      message: 'Partner updated successfully',
      partner_id,
      clientUserId: clientUser._id,
      fieldsUpdated: fieldsUpdated,
      newValues: fieldsToUpdate,
      action: 'updated'
    };

  } catch (error) {
    console.error('❌ Error procesando actualización de partner:', error);
    
    // Intentar registrar el error en el historial si es posible
    try {
      if (data.orbit_user_id) {
        const clientUser = await ClientUser.findById(data.orbit_user_id);
        if (clientUser) {
          const errorHistoryEntry = {
            action: 'update',
            timestamp: new Date(),
            odooModel: 'res.partner',
            odooId: partner_id.toString(),
            status: 'error',
            fieldsUpdated: [],
            error: error.message,
            changes: data.changes
          };

          await ClientUser.findByIdAndUpdate(
            clientUser._id,
            { $push: { syncHistory: errorHistoryEntry } }
          );
        }
      }
    } catch (historyError) {
      console.error('❌ Error registrando en historial:', historyError);
    }

    throw error;
  }
}

module.exports = {
  processOdooPartnerUpdate
};
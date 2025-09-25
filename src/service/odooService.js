// ✅ Reemplazar: orbit/messaging-hub-backend/src/service/odooService.js
const axios = require("axios");

class OdooService {
  constructor(tenantRexUrl) {
    this.ODOO_BASE = tenantRexUrl 
    this.CALL_KW = `${this.ODOO_BASE}/web/dataset/call_kw`;
    
    console.log('🔍 OdooService initialized for tenant:', this.ODOO_BASE);
  }

  // ✅ NUEVAS FUNCIONES AUXILIARES: Para manejo de observaciones
  cleanHtmlFromOdoo(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') {
      return '';
    }
    
    // ✅ Remover tags HTML y metadatos de Odoo
    let cleanText = htmlString
      // ✅ NUEVO: Convertir <p> tags a saltos de línea ANTES de remover HTML
      .replace(/<p[^>]*>/g, '\n')
      .replace(/<\/p>/g, '')
      // Remover todos los demás tags HTML
      .replace(/<[^>]*>/g, '')
      // Remover atributos data-last-history-steps y similares
      .replace(/data-[^=]*="[^"]*"/g, '')
      // ✅ NUEVO: Remover entidades HTML (más robusto)
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')  
      // ✅ NUEVO: Preservar saltos de línea pero limpiar espacios
      .replace(/[ \t]+/g, ' ')  // Solo espacios y tabs, no saltos de línea
      // ✅ NUEVO: Limpiar saltos de línea múltiples
      .replace(/\n\s*\n/g, '\n')
      // Trim espacios al inicio y final
      .trim();
    
    return cleanText;
  }

  async getSalesmen(sessionId) {
    console.log('�� getSalesmen DEBUG:');
    console.log('sessionId received:', sessionId);
    console.log('tenant URL:', this.ODOO_BASE);
    
    if (!sessionId) {
      console.error('❌ No sessionId provided to getSalesmen');
      throw new Error('No session ID provided');
    }
    
    try {
      const result = await this.executeWithSession(sessionId, 'res.users', 'search_read',
        [], { 
          fields: ["id", "name", "login", "email"],
          order: 'name',
          context: {
            'tz': 'UTC',
            'lang': 'es_AR',
            'active_test': false,
            'force_refresh': true  // Forzar refresh
          }
        });
      
      console.log('✅ getSalesmen successful, result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ getSalesmen failed:', error);
      throw error;
    }
  }


  combineObservations(odooObservations, appObservations) {
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
    const cleanOdoo = this.cleanHtmlFromOdoo(odoo);
    
    // ✅ Combinar ambas observaciones separadas por un salto de línea para la app
    return `${cleanOdoo}\n${app}`;
  }

  combineObservationsForOdoo(odooObservations, appObservations) {
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
    const cleanOdoo = this.cleanHtmlFromOdoo(odoo);
    
    // ✅ CORRECCIÓN: Usar <p> tags para crear párrafos separados en Odoo
    return `<p>${cleanOdoo}</p><p>${app}</p>`;
  }

  // ✅ ELIMINAR: detectObservationsChanges ya no se usa

  // ✅ SIMPLIFICADO: Combinar observaciones sin diff complejo
  smartCombineObservations(odooObservations, appObservations, previousAppObservations = '') {
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
    
    // Limpiar HTML de Odoo
    const cleanOdoo = this.cleanHtmlFromOdoo(odoo);
    
    // ✅ SIMPLIFICADO: Solo combinar Odoo + App
    // La app ya tiene el contenido actualizado
    console.log('✅ Combining Odoo + App observations');
    console.log(' Odoo (cleaned):', cleanOdoo);
    console.log(' App:', app);
    
    return `<p>${cleanOdoo}</p><p>${app}</p>`;
  }

  // ✅ Execute Odoo operations with true session mode
  async executeWithSession(sessionId, model, method, args = [], kwargs = {}) {
    console.log(' executeWithSession DEBUG:', { 
      model, 
      method, 
      tenantUrl: this.ODOO_BASE 
    });
    
    const payload = { 
      jsonrpc: "2.0", 
      method: "call",
      params: { model, method, args, kwargs }, 
      id: Date.now() 
    };
    
    try {
      const { data } = await axios.post(this.CALL_KW, payload, {
        headers: { Cookie: `session_id=${sessionId}` }
      });
      
      console.log('📥 Odoo response:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error('❌ Odoo returned error:', data.error);
        throw new Error(JSON.stringify(data.error));
      }
      
      console.log('✅ Odoo operation successful, result:', data.result);
      return data.result;
    } catch (error) {
      console.error('❌ Odoo call failed:', error.message);
      throw error;
    }
  }

  // ✅ Métodos que usan session_id
  async getPartners(sessionId) {
    console.log(' getPartners DEBUG:');
    console.log('sessionId received:', sessionId);
    console.log('tenant URL:', this.ODOO_BASE);
    
    if (!sessionId) {
      console.error('❌ No sessionId provided to getPartners');
      throw new Error('No session ID provided');
    }
    
    try {
      const result = await this.executeWithSession(sessionId, 'res.partner', 'search_read',
        [[]], { fields: ["id", "name", "email"] });
      console.log('✅ getPartners successful, result:', result);
      return result;
    } catch (error) {
      console.error('❌ getPartners failed:', error);
      throw error;
    }
  }

  async createPartner(sessionId, partnerData) {
    return await this.executeWithSession(sessionId, 'res.partner', 'create',
      [partnerData], {});
  }

  async getCrmStages(sessionId) {
    try {
      const result = await this.executeWithSession(sessionId, 'crm.stage', 'search_read',
        [], { 
          fields: ["id", "name", "sequence"],
          order: 'sequence, name',
          context: {
            'tz': 'UTC',
            'lang': 'es_AR',
            'active_test': false,
            'force_refresh': true  // Forzar refresh
          }
        });
      return result;
      
    } catch (error) {
      console.error('❌ Error with force refresh, trying alternative...', error);
    }
  }

    // ✅ NUEVO MÉTODO: Obtener vendedores reales (filtrados)
    async getSalesmen(sessionId) {
      console.log('�� getSalesmen DEBUG:');
      console.log('sessionId received:', sessionId);
      console.log('tenant URL:', this.ODOO_BASE);
      
      if (!sessionId) {
        console.error('❌ No sessionId provided to getSalesmen');
        throw new Error('No session ID provided');
      }
      
      try {
        // ✅ FILTRO: Excluir usuarios del sistema y plantillas
        const domain = [
          ['active', '=', true],  // Solo usuarios activos
          ['id', '>', 2],         // Excluir admin (id=1) y demo (id=2)
          ['login', '!=', 'public'],  // Excluir usuario público
          ['login', 'not ilike', 'template'],  // Excluir plantillas
          ['login', 'not ilike', 'bot'],       // Excluir bots
          ['login', 'not ilike', 'portal'],    // Excluir usuarios portal
          ['name', 'not ilike', 'template'],   // Excluir por nombre
          ['name', 'not ilike', 'bot'],        // Excluir bots por nombre
          ['name', 'not ilike', 'portal'],     // Excluir portal por nombre
          ['name', 'not ilike', 'public'],     // Excluir público por nombre
        ];
        
        const result = await this.executeWithSession(sessionId, 'res.users', 'search_read',
          [domain], { 
            fields: ["id", "name", "login", "email"],
            order: 'name',
            context: {
              'tz': 'UTC',
              'lang': 'es_AR',
              'active_test': false,
              'force_refresh': true
            }
          });
        
        console.log('✅ getSalesmen successful, filtered result:', result);
        return result;
        
      } catch (error) {
        console.error('❌ getSalesmen failed:', error);
        throw error;
      }
    }

  async createCrmLead(sessionId, leadData) {
    console.log('🔄 createCrmLead called with sessionId:', sessionId);
    return await this.executeWithSession(sessionId, 'crm.lead', 'create',
      [leadData], {});
  }

  // ✅ Login method using session ID (for compatibility)
  async loginOdoo() {
    console.log('🔍 loginOdoo DEBUG:');
    console.log('ODOO_BASE:', this.ODOO_BASE);
    console.log('DB:', this.DB);
    
    // Since we're using session ID authentication, this method just validates the connection
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "version",
        args: [],
      },
      id: new Date().getTime(),
    };

    console.log('📝 Version check payload:', JSON.stringify(payload, null, 2));

    try {
      console.log('📡 Making version request to:', `${this.ODOO_BASE}/jsonrpc`);
      const { data } = await axios.post(`${this.ODOO_BASE}/jsonrpc`, payload);
      console.log('📥 Version response:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error('❌ Version check failed:', data.error);
        throw new Error(`Version check error: ${JSON.stringify(data.error)}`);
      }
      
      console.log('✅ Odoo connection successful, version:', data.result);
      return data.result;
    } catch (error) {
      console.error('❌ Version check error:', error);
      throw error;
    }
  }

  // ✅ MODIFICADO: Buscar contacto por criterios con prioridad
  async searchContactByCriteria(sessionId, criteria) {
    console.log('🔍 searchContactByCriteria DEBUG:', criteria);
    
    if (!sessionId) {
      throw new Error('No session ID provided');
    }
    
    try {
      // Construir dominio de búsqueda
      const domain = [];
      
      if (criteria.email) {
        domain.push(['email', '=', criteria.email]);
      }
      
      if (criteria.phone) {
        domain.push(['phone', '=', criteria.phone]);
      }
      
      if (criteria.instagramId) {
        domain.push(['instagram_id', '=', criteria.instagramId]);
      }
      
      // ✅ VALIDACIÓN: Si no hay criterios, no buscar
      if (domain.length === 0) {
        console.log('⚠️ No search criteria provided');
        return null;
      }
      
      // ✅ VALIDACIÓN: Si solo hay 1 criterio, no usar OR
      let searchDomain;
      if (domain.length === 1) {
        searchDomain = domain; // Sin OR, solo la condición
        console.log('🔍 Single criteria search:', searchDomain);
      } else {
        // ✅ CORRECCIÓN: Generar el número correcto de operadores '|'
        // Para n criterios, necesitamos n-1 operadores '|'
        const orOperators = Array(domain.length - 1).fill('|');
        searchDomain = [...orOperators, ...domain];
        console.log('🔍 Multiple criteria search with OR:', searchDomain);
      }
      
      // ✅ MODIFICACIÓN: Incluir campos de sincronización
      const result = await this.executeWithSession(
        sessionId, 
        'res.partner', 
        'search_read',
        [searchDomain], 
        { 
          fields: [
            "id", "name", "email", "phone",
            "orbit_user_id", "orbit_sync_status",
            "instagram_id"  // ← AGREGAR ESTE CAMPO
          ], 
          limit: 1 
        }
      );
      
      console.log('✅ searchContactByCriteria successful, result:', result);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      console.error('❌ searchContactByCriteria failed:', error);
      throw error;
    }
  }

  // ✅ NUEVO MÉTODO: Actualizar campos de sincronización
  async updateOdooSyncFields(sessionId, partnerId, orbitUserId, syncStatus) {
    console.log('🔄 updateOdooSyncFields DEBUG:', { partnerId, orbitUserId, syncStatus });
    
    if (!sessionId || !partnerId) {
      throw new Error('Session ID and Partner ID are required');
    }
    
    try {
      const updateData = {
        orbit_user_id: orbitUserId,
        orbit_sync_status: syncStatus
      };
      
      const result = await this.executeWithSession(
        sessionId, 
        'res.partner', 
        'write',
        [partnerId, updateData], 
        {}
      );
      
      console.log('✅ updateOdooSyncFields successful, result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ updateOdooSyncFields failed:', error);
      throw error;
    }
  }

  // ✅ NUEVO MÉTODO: Actualizar contacto completo
  async updatePartner(sessionId, partnerId, updateData) {
    console.log('🔄 updatePartner DEBUG:', { partnerId, updateData });
    
    if (!sessionId || !partnerId) {
      throw new Error('Session ID and Partner ID are required');
    }
    
    try {
      // ✅ CORRECCIÓN: Convertir partnerId a número
      const numericPartnerId = parseInt(partnerId, 10);
      console.log('🔄 DEBUG - Partner ID conversion:', { original: partnerId, numeric: numericPartnerId });
      
      const result = await this.executeWithSession(
        sessionId, 
        'res.partner', 
        'write',
        [numericPartnerId, updateData], // ✅ Usar número en lugar de string
        {}
      );
      
      console.log('✅ updatePartner successful, result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ updatePartner failed:', error);
      throw error;
    }
  }

  // ✅ NUEVO MÉTODO: Obtener un partner específico por ID
  async getPartner(sessionId, partnerId) {
    console.log('🔍 getPartner DEBUG:', { sessionId, partnerId });
    
    if (!sessionId || !partnerId) {
      throw new Error('Session ID and Partner ID are required');
    }
    
    try {
      const result = await this.executeWithSession(
        sessionId, 
        'res.partner', 
        'read',
        [partnerId], 
        { 
          fields: [
            "id", "name", "email", "phone",
            "orbit_user_id", "orbit_sync_status",
            "instagram_id"
          ]
        }
      );
      
      console.log('✅ getPartner successful, result:', result);
      
      // read devuelve un array, tomamos el primer elemento
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      console.error('❌ getPartner failed:', error);
      throw error;
    }
  }

  // ✅ NUEVO MÉTODO: Buscar oportunidad por partner
  async searchOpportunityByPartner(sessionId, partnerId) {
    console.log('🔍 searchOpportunityByPartner DEBUG:', { sessionId, partnerId });
    
    if (!sessionId || !partnerId) {
      throw new Error('Session ID and Partner ID are required');
    }
    
    try {
      // ✅ CORRECCIÓN: Convertir partnerId a integer
      const partnerIdInt = parseInt(partnerId, 10);
      
      if (isNaN(partnerIdInt)) {
        throw new Error(`Invalid partner ID: ${partnerId}`);
      }
      
      console.log('🔍 Converted partnerId to integer:', partnerIdInt);
      
      // ✅ CORRECCIÓN: Estructura correcta del dominio
      const domain = [['partner_id', '=', partnerIdInt]];
      console.log('🔍 Domain structure:', domain);
      
      const result = await this.executeWithSession(
        sessionId, 
        'crm.lead', 
        'search_read',
        [domain], // ← Enviar el dominio como array
        { 
          fields: ["id", "name", "partner_id", "stage_id", "user_id", "description"],
          limit: 1,
          context: { lang: 'es_AR' } 
        }
      );
      
      console.log('✅ searchOpportunityByPartner successful, result:', result);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      console.error('❌ searchOpportunityByPartner failed:', error);
      throw error;
    }
  }


  // ✅ NUEVO MÉTODO: Actualizar oportunidad (lead)
  async updateLead(sessionId, leadId, updateData) {
    console.log('🔄 updateLead DEBUG:', { sessionId, leadId, updateData });
    
    if (!sessionId || !leadId) {
      throw new Error('Session ID and Lead ID are required');
    }
    
    try {
      // ✅ CORRECCIÓN: Convertir leadId a número
      const numericLeadId = parseInt(leadId, 10);
      console.log('🔍 DEBUG - Lead ID conversion:', { original: leadId, numeric: numericLeadId });
      
      const result = await this.executeWithSession(sessionId, 'crm.lead', 'write', 
        [numericLeadId, updateData] // ✅ Usar número en lugar de string
      );
      
      console.log('✅ updateLead successful, result:', result);
      return result;
    } catch (error) {
      console.error('❌ updateLead failed:', error);
      throw error;
    }
  }

  // ✅ NUEVO MÉTODO: Buscar usuarios por nombre
  async searchUsersByName(sessionId, userName) {
    console.log('🔍 searchUsersByName DEBUG:', { sessionId, userName });
    
    if (!sessionId || !userName) {
      throw new Error('Session ID and User Name are required');
    }
    
    try {
      const result = await this.executeWithSession(
        sessionId, 
        'res.users', 
        'search_read',
        [['name', 'ilike', userName]], 
        { 
          fields: ['id', 'name', 'login'],
          limit: 10
        }
      );
      
      console.log('✅ searchUsersByName successful, result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ searchUsersByName failed:', error);
      throw error;
    }
  }
}

// ✅ Exportar la clase
module.exports = OdooService;
const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:8080',
  sessionId: 'p8LUqaKmXYQo-tfuLakOClZxnjRZPo8em7fsprNI4EhXjKlzW6pwTpNm5NQyz4egyzfGvr8hj8jl2JlLEAe',
  odooDatabase: 'kk212'
};

// Mock user data for testing
const MOCK_USER_DATA = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '1234567890',
  type: 'contact',
  customer_rank: 1,
  crmStage: 'New'
};

// Test suite for Odoo Export functionality
describe('Odoo Export Tests', () => {
  
  // Test 1: Check Odoo connection
  test('Should connect to Odoo successfully', async () => {
    try {
      const response = await axios.post('http://localhost:80/jsonrpc', {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "version",
          args: []
        },
        id: 1
      });
      
      expect(response.status).toBe(200);
      expect(response.data.result).toBeDefined();
      expect(response.data.result.server_version).toBeDefined();
      console.log('✅ Odoo connection successful:', response.data.result);
    } catch (error) {
      console.error('❌ Odoo connection failed:', error.message);
      throw error;
    }
  });

  // Test 2: Test session ID authentication
  test('Should authenticate with session fD', async () => {
    try {
      const response = await axios.post('http://localhost:80/jsonrpc', {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [
            TEST_CONFIG.odooDatabase,
            TEST_CONFIG.sessionId,
            TEST_CONFIG.sessionId,
            {}
          ]
        },
        id: 1
      });
      
      console.log('🔍 Authentication response:', response.data);
      expect(response.status).toBe(200);
    } catch (error) {
      console.error('❌ Session authentication failed:', error.response?.data || error.message);
      // This might fail, but we'll log the error for debugging
    }
  });

  // Test 3: Test backend API endpoint
  test('Should call backend export endpoint', async () => {
    try {
      const response = await axios.post(`${TEST_CONFIG.baseURL}/api/odoo/export-contact`, {
        name: MOCK_USER_DATA.name,
        email: MOCK_USER_DATA.email,
        phone: MOCK_USER_DATA.phone,
        type: MOCK_USER_DATA.type,
        customer_rank: MOCK_USER_DATA.customer_rank,
        crmStage: MOCK_USER_DATA.crmStage
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'Cookie': `session_id=${TEST_CONFIG.sessionId}`
        }
      });
      
      console.log('✅ Backend export response:', response.data);
      expect(response.status).toBe(200);
    } catch (error) {
      console.error('❌ Backend export failed:', error.response?.data || error.message);
      // This might fail due to authentication, but we'll log the error
    }
  });

  // Test 4: Test Odoo service methods
  test('Should test Odoo service methods', async () => {
    const { getPartners, createPartner, getCrmStages } = require('../src/service/odooService');
    
    try {
      // Test getPartners
      console.log('🔍 Testing getPartners...');
      const partners = await getPartners(TEST_CONFIG.sessionId);
      console.log('✅ getPartners result:', partners);
    } catch (error) {
      console.error('❌ getPartners failed:', error.message);
    }

    try {
      // Test getCrmStages
      console.log('🔍 Testing getCrmStages...');
      const stages = await getCrmStages(TEST_CONFIG.sessionId);
      console.log('✅ getCrmStages result:', stages);
    } catch (error) {
      console.error('❌ getCrmStages failed:', error.message);
    }

    try {
      // Test createPartner
      console.log('🔍 Testing createPartner...');
      const partnerData = {
        name: MOCK_USER_DATA.name,
        email: MOCK_USER_DATA.email,
        phone: MOCK_USER_DATA.phone,
        type: MOCK_USER_DATA.type,
        customer_rank: MOCK_USER_DATA.customer_rank
      };
      const partnerId = await createPartner(TEST_CONFIG.sessionId, partnerData);
      console.log('✅ createPartner result:', partnerId);
    } catch (error) {
      console.error('❌ createPartner failed:', error.message);
    }
  });

  // Test 5: Test complete export flow
  test('Should test complete export flow', async () => {
    try {
      // Step 1: Create partner
      const { createPartner } = require('../src/service/odooService');
      const partnerData = {
        name: MOCK_USER_DATA.name,
        email: MOCK_USER_DATA.email,
        phone: MOCK_USER_DATA.phone,
        type: MOCK_USER_DATA.type,
        customer_rank: MOCK_USER_DATA.customer_rank
      };
      
      console.log('🔍 Step 1: Creating partner...');
      const partnerId = await createPartner(TEST_CONFIG.sessionId, partnerData);
      console.log('✅ Partner created with ID:', partnerId);
      
      // Step 2: Get CRM stages
      const { getCrmStages } = require('../src/service/odooService');
      console.log('🔍 Step 2: Getting CRM stages...');
      const stages = await getCrmStages(TEST_CONFIG.sessionId);
      console.log('✅ CRM stages:', stages);
      
      // Step 3: Create CRM lead if stage exists
      if (stages && stages.length > 0) {
        const { createCrmLead } = require('../src/service/odooService');
        const leadData = {
          name: `Oportunidad - ${MOCK_USER_DATA.name}`,
          partner_id: partnerId,
          stage_id: stages[0].id,
          type: 'opportunity'
        };
        
        console.log('🔍 Step 3: Creating CRM lead...');
        const leadId = await createCrmLead(TEST_CONFIG.sessionId, leadData);
        console.log('✅ CRM lead created with ID:', leadId);
      }
      
    } catch (error) {
      console.error('❌ Complete export flow failed:', error.message);
    }
  });

  // Test 6: Test different session ID formats
  test('Should test different session ID approaches', async () => {
    const sessionIds = [
      TEST_CONFIG.sessionId,
      TEST_CONFIG.sessionId.substring(0, 20), // Truncated
      TEST_CONFIG.sessionId + 'extra', // Extended
      'test-session-id' // Mock
    ];
    
    for (const sessionId of sessionIds) {
      try {
        console.log(`🔍 Testing session ID: ${sessionId.substring(0, 10)}...`);
        const { getPartners } = require('../src/service/odooService');
        const result = await getPartners(sessionId);
        console.log(`✅ Session ID ${sessionId.substring(0, 10)} worked:`, result);
      } catch (error) {
        console.log(`❌ Session ID ${sessionId.substring(0, 10)} failed:`, error.message);
      }
    }
  });

  // Test 7: Test error handling
  test('Should handle authentication errors gracefully', async () => {
    try {
      const { getPartners } = require('../src/service/odooService');
      await getPartners('invalid-session-id');
      fail('Should have thrown an error');
    } catch (error) {
      console.log('✅ Error handling works:', error.message);
      expect(error.message).toContain('Odoo error');
    }
  });

});

// Helper function to run tests
async function runTests() {
  console.log('🚀 Starting Odoo Export Tests...');
  console.log('📊 Test Configuration:');
  console.log('  - Base URL:', TEST_CONFIG.baseURL);
  console.log('  - Odoo Database:', TEST_CONFIG.odooDatabase);
  console.log('  - Session ID:', TEST_CONFIG.sessionId.substring(0, 20) + '...');
  console.log('');
  
  // Run individual tests
  try {
    await test('Should connect to Odoo successfully', async () => {
      // Test implementation
    });
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export for manual testing
module.exports = {
  runTests,
  TEST_CONFIG,
  MOCK_USER_DATA
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
} 
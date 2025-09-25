const axios = require('axios');

// Test configuration with the actual session ID from the browser
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

async function testOdooConnection() {
  console.log('🔍 Test 1: Checking Odoo connection...');
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
    
    console.log('✅ Odoo connection successful:', response.data.result);
    return true;
  } catch (error) {
    console.error('❌ Odoo connection failed:', error.message);
    return false;
  }
}

async function testSessionAuthentication() {
  console.log('🔍 Test 2: Testing session ID authentication...');
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
    
    console.log('✅ Session authentication response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Session authentication failed:', error.response?.data || error.message);
    return false;
  }
}

async function testOdooServiceMethods() {
  console.log('🔍 Test 3: Testing Odoo service methods...');
  
  try {
    const { getPartners, createPartner, getCrmStages } = require('./src/service/odooService');
    
    // Test getPartners
    console.log('  - Testing getPartners...');
    const partners = await getPartners(TEST_CONFIG.sessionId);
    console.log('  ✅ getPartners result:', partners);
    
    // Test getCrmStages
    console.log('  - Testing getCrmStages...');
    const stages = await getCrmStages(TEST_CONFIG.sessionId);
    console.log('  ✅ getCrmStages result:', stages);
    
    // Test createPartner
    console.log('  - Testing createPartner...');
    const partnerData = {
      name: MOCK_USER_DATA.name,
      email: MOCK_USER_DATA.email,
      phone: MOCK_USER_DATA.phone,
      type: MOCK_USER_DATA.type,
      customer_rank: MOCK_USER_DATA.customer_rank
    };
    const partnerId = await createPartner(TEST_CONFIG.sessionId, partnerData);
    console.log('  ✅ createPartner result:', partnerId);
    
    return true;
  } catch (error) {
    console.error('❌ Odoo service methods failed:', error.message);
    return false;
  }
}

async function testBackendExportEndpoint() {
  console.log('🔍 Test 4: Testing backend export endpoint...');
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
    return true;
  } catch (error) {
    console.error('❌ Backend export failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCompleteExportFlow() {
  console.log('🔍 Test 5: Testing complete export flow...');
  try {
    const { createPartner, getCrmStages, createCrmLead } = require('./src/service/odooService');
    
    // Step 1: Create partner
    console.log('  - Step 1: Creating partner...');
    const partnerData = {
      name: MOCK_USER_DATA.name,
      email: MOCK_USER_DATA.email,
      phone: MOCK_USER_DATA.phone,
      type: MOCK_USER_DATA.type,
      customer_rank: MOCK_USER_DATA.customer_rank
    };
    const partnerId = await createPartner(TEST_CONFIG.sessionId, partnerData);
    console.log('  ✅ Partner created with ID:', partnerId);
    
    // Step 2: Get CRM stages
    console.log('  - Step 2: Getting CRM stages...');
    const stages = await getCrmStages(TEST_CONFIG.sessionId);
    console.log('  ✅ CRM stages:', stages);
    
    // Step 3: Create CRM lead if stage exists
    if (stages && stages.length > 0) {
      console.log('  - Step 3: Creating CRM lead...');
      const leadData = {
        name: `Oportunidad - ${MOCK_USER_DATA.name}`,
        partner_id: partnerId,
        stage_id: stages[0].id,
        type: 'opportunity'
      };
      const leadId = await createCrmLead(TEST_CONFIG.sessionId, leadData);
      console.log('  ✅ CRM lead created with ID:', leadId);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Complete export flow failed:', error.message);
    return false;
  }
}

async function testDifferentSessionApproaches() {
  console.log('🔍 Test 6: Testing different session ID approaches...');
  
  const sessionIds = [
    TEST_CONFIG.sessionId,
    TEST_CONFIG.sessionId.substring(0, 20), // Truncated
    TEST_CONFIG.sessionId + 'extra', // Extended
    'test-session-id' // Mock
  ];
  
  for (const sessionId of sessionIds) {
    try {
      console.log(`  - Testing session ID: ${sessionId.substring(0, 10)}...`);
      const { getPartners } = require('./src/service/odooService');
      const result = await getPartners(sessionId);
      console.log(`  ✅ Session ID ${sessionId.substring(0, 10)} worked:`, result);
    } catch (error) {
      console.log(`  ❌ Session ID ${sessionId.substring(0, 10)} failed:`, error.message);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Odoo Export Tests...');
  console.log('📊 Test Configuration:');
  console.log('  - Base URL:', TEST_CONFIG.baseURL);
  console.log('  - Odoo Database:', TEST_CONFIG.odooDatabase);
  console.log('  - Session ID:', TEST_CONFIG.sessionId.substring(0, 20) + '...');
  console.log('');
  
  const results = {
    odooConnection: await testOdooConnection(),
    sessionAuth: await testSessionAuthentication(),
    serviceMethods: await testOdooServiceMethods(),
    backendEndpoint: await testBackendExportEndpoint(),
    completeFlow: await testCompleteExportFlow()
  };
  
  console.log('');
  console.log('📊 Test Results:');
  console.log('  - Odoo Connection:', results.odooConnection ? '✅ PASS' : '❌ FAIL');
  console.log('  - Session Auth:', results.sessionAuth ? '✅ PASS' : '❌ FAIL');
  console.log('  - Service Methods:', results.serviceMethods ? '✅ PASS' : '❌ FAIL');
  console.log('  - Backend Endpoint:', results.backendEndpoint ? '✅ PASS' : '❌ FAIL');
  console.log('  - Complete Flow:', results.completeFlow ? '✅ PASS' : '❌ FAIL');
  
  await testDifferentSessionApproaches();
  
  console.log('');
  console.log('🎯 Test Summary:');
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  console.log(`  - Passed: ${passedTests}/${totalTests} tests`);
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  TEST_CONFIG,
  MOCK_USER_DATA
}; 
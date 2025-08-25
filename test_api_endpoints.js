#!/usr/bin/env node

/**
 * Script di test per verificare gli endpoint API
 * Esegui con: node test_api_endpoints.js
 */

const https = require('https');

// Configurazione
const BACKEND_URL = 'https://api.agoralia.app';
const FRONTEND_URL = 'https://agoralia.vercel.app';

// Utility per fare richieste HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Test endpoint backend diretto
async function testBackendEndpoint(path, method = 'GET') {
  console.log(`\n🔍 Testing BACKEND: ${method} ${BACKEND_URL}${path}`);
  
  try {
    const result = await makeRequest(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'API-Test-Script/1.0'
      }
    });
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Data: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
    
    return result.success;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Test endpoint frontend (proxy Vercel)
async function testFrontendEndpoint(path, method = 'GET') {
  console.log(`\n🔍 Testing FRONTEND (proxy): ${method} ${FRONTEND_URL}/api${path}`);
  
  try {
    const result = await makeRequest(`${FRONTEND_URL}/api${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'API-Test-Script/1.0'
      }
    });
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Data: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
    
    return result.success;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Test principali
async function runTests() {
  console.log('🚀 Starting API Endpoint Tests...\n');
  
  const tests = [
    { path: '/campaigns', method: 'GET', description: 'List campaigns' },
    { path: '/health', method: 'GET', description: 'Health check' },
    { path: '/kb/progress', method: 'GET', description: 'KB progress' },
    { path: '/campaigns', method: 'POST', description: 'Create campaign (should fail with 405)' }
  ];
  
  let backendSuccess = 0;
  let frontendSuccess = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.description}`);
    
    // Test backend diretto
    const backendOk = await testBackendEndpoint(test.path, test.method);
    if (backendOk) backendSuccess++;
    
    // Test frontend proxy (solo per GET)
    if (test.method === 'GET') {
      const frontendOk = await testFrontendEndpoint(test.path, test.method);
      if (frontendOk) frontendSuccess++;
    }
  }
  
  // Riepilogo
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`Backend direct: ${backendSuccess}/${tests.length} ✅`);
  console.log(`Frontend proxy: ${frontendSuccess}/${tests.filter(t => t.method === 'GET').length} ✅`);
  
  if (backendSuccess === tests.length) {
    console.log('\n🎉 Backend API working correctly!');
  } else {
    console.log('\n⚠️  Some backend endpoints have issues');
  }
  
  if (frontendSuccess === tests.filter(t => t.method === 'GET').length) {
    console.log('🎉 Frontend proxy working correctly!');
  } else {
    console.log('⚠️  Frontend proxy has issues - check Vercel configuration');
  }
  
  console.log('\n💡 Next steps:');
  console.log('1. If backend works but frontend doesn\'t: check Vercel proxy config');
  console.log('2. If both fail: check Railway deployment and CORS');
  console.log('3. Check browser console for CSP errors');
}

// Esegui i test
runTests().catch(console.error);

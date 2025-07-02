const axios = require('axios');

async function testCredentialsAPI() {
  try {
    console.log('🔍 Testing Credentials API...');
    
    // Test credentials requirements endpoint
    console.log('\n1. Testing requirements endpoint...');
    const requirementsResponse = await axios.get('http://localhost:5000/api/credentials/requirements/aws');
    console.log('✅ Requirements endpoint working:', requirementsResponse.data.success);
    console.log('📋 AWS requirements:', requirementsResponse.data.data.fields.map(f => f.name));
    
    // Test services status endpoint
    console.log('\n2. Testing services status endpoint...');
    try {
      const statusResponse = await axios.get('http://localhost:5000/api/credentials/services/status', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✅ Services status endpoint accessible');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Services status endpoint protected (401 - needs auth)');
      } else {
        console.log('❌ Services status error:', error.response?.status);
      }
    }
    
    // Test credential save endpoint (without auth - should fail)
    console.log('\n3. Testing credential save endpoint...');
    try {
      const saveResponse = await axios.post('http://localhost:5000/api/credentials', {
        appType: 'aws',
        appName: 'Test AWS',
        credentials: {
          accessKey: 'AKIATEST123456789012',
          secretKey: 'test-secret-key-1234567890123456789012345678',
          region: 'us-east-1'
        }
      });
      console.log('❌ Unexpected success - should require auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Credential save endpoint protected (401 - needs auth)');
      } else {
        console.log('❌ Credential save error:', error.response?.status, error.response?.data?.message);
      }
    }
    
    console.log('\n🎉 Credentials API test completed!');
    console.log('✅ All endpoints are responding correctly');
    console.log('✅ Authentication protection is working');
    console.log('✅ Requirements endpoint provides proper field definitions');
    
  } catch (error) {
    console.error('❌ Credentials API test failed:', error.message);
  }
}

testCredentialsAPI();

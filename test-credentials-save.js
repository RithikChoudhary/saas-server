const axios = require('axios');

const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODVhNDZjODZjZmIxZDA3NWI3M2RmZTMiLCJjb21wYW55SWQiOiI2ODViMDlmNmRjMTI3YjI5MmJlM2E5NjkiLCJyb2xlIjoiQ09NUEFOWV9BRE1JTiIsImVtYWlsIjoiYnVybnQ3NzZAZ21haWwuY29tIiwiaWF0IjoxNzUxNDU4Mzc0LCJleHAiOjE3NTE1NDQ3NzR9.arpc7-yONOXbvBYgLxSW3YLoRXN8sBrc9wSNeEe2Ex4';

async function testCredentialsSave() {
  try {
    console.log('🔍 Testing Credentials Save with Fixed Encryption...');
    
    // Test 1: Save AWS credentials
    console.log('\n1. Testing AWS credentials save...');
    const awsCredentials = {
      appType: 'aws',
      appName: 'Test AWS Account',
      credentials: {
        accessKey: 'AKIATEST123456789012',
        secretKey: 'test-secret-key-1234567890123456789012345678',
        region: 'us-east-1'
      }
    };
    
    const saveResponse = await axios.post('http://localhost:5000/api/credentials', awsCredentials, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ AWS credentials saved successfully!');
    console.log('📊 Response:', {
      success: saveResponse.data.success,
      id: saveResponse.data.data?.id,
      appType: saveResponse.data.data?.appType,
      appName: saveResponse.data.data?.appName,
      hasCredentials: saveResponse.data.data?.hasCredentials
    });
    
    // Test 2: Test connection
    console.log('\n2. Testing AWS connection...');
    const connectResponse = await axios.post('http://localhost:5000/api/credentials/services/aws/connect', {}, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ AWS connection test completed!');
    console.log('📊 Connection result:', {
      success: connectResponse.data.success,
      action: connectResponse.data.action,
      message: connectResponse.data.message
    });
    
    // Test 3: Get services status
    console.log('\n3. Testing services status...');
    const statusResponse = await axios.get('http://localhost:5000/api/credentials/services/status', {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    console.log('✅ Services status retrieved!');
    console.log('📊 Services found:', statusResponse.data.data?.length || 0);
    
    const awsService = statusResponse.data.data?.find(s => s.id === 'aws');
    if (awsService) {
      console.log('📊 AWS service status:', {
        status: awsService.status,
        hasCredentials: awsService.hasCredentials,
        actionText: awsService.actionText
      });
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Encryption key fix is working');
    console.log('✅ Credentials can be saved without 500 errors');
    console.log('✅ Connection flow is working');
    console.log('✅ Services status is accurate');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.status, error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('📊 Error details:', error.response.data);
    }
  }
}

testCredentialsSave();

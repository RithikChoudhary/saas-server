const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Test credentials for authentication
const testCredentials = {
  email: 'admin@company.com',
  password: 'admin123'
};

async function testDisconnectService() {
  try {
    console.log('🔍 Testing Service Disconnect Functionality...\n');

    // Step 1: Login to get auth token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testCredentials);
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Set up axios with auth header
    const authAxios = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Step 2: Check current services status
    console.log('2. Checking current services status...');
    const statusResponse = await authAxios.get('/credentials/services/status');
    
    if (!statusResponse.data.success) {
      throw new Error('Failed to get services status: ' + statusResponse.data.message);
    }

    const services = statusResponse.data.data;
    const connectedServices = services.filter(s => s.hasActiveConnection);
    
    console.log('📊 Current Status:');
    console.log(`   Total services: ${services.length}`);
    console.log(`   Connected services: ${connectedServices.length}`);
    
    if (connectedServices.length > 0) {
      console.log('📋 Connected Services:');
      connectedServices.forEach(service => {
        console.log(`   🟢 ${service.name} (${service.id}) - ${service.actionText}`);
      });
    }
    console.log('');

    // Step 3: Test disconnect functionality
    if (connectedServices.length === 0) {
      console.log('⚠️  No connected services found to test disconnect functionality.');
      console.log('   Please connect a service first using the credentials page.');
      return;
    }

    // Test disconnecting the first connected service
    const serviceToDisconnect = connectedServices[0];
    console.log(`3. Testing disconnect for ${serviceToDisconnect.name}...`);
    
    try {
      const disconnectResponse = await authAxios.delete(`/credentials/services/${serviceToDisconnect.id}/disconnect`);
      
      if (disconnectResponse.data.success) {
        console.log(`✅ ${serviceToDisconnect.name} disconnected successfully!`);
        console.log('📊 Disconnect Results:', disconnectResponse.data.data);
      } else {
        console.log(`❌ Disconnect failed: ${disconnectResponse.data.message}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️  Comprehensive disconnect endpoint not found, testing manual cleanup...`);
        
        // Test manual cleanup by deleting credentials
        try {
          const deleteResponse = await authAxios.delete(`/credentials/services/${serviceToDisconnect.id}`);
          
          if (deleteResponse.data.success) {
            console.log(`✅ Manual cleanup successful for ${serviceToDisconnect.name}`);
            console.log('📊 Cleanup Results:', deleteResponse.data.data);
          } else {
            console.log(`❌ Manual cleanup failed: ${deleteResponse.data.message}`);
          }
        } catch (manualError) {
          console.log(`❌ Manual cleanup error:`, manualError.response?.data?.message || manualError.message);
        }
      } else {
        console.log(`❌ Disconnect error:`, error.response?.data?.message || error.message);
      }
    }

    // Step 4: Verify disconnection
    console.log('\n4. Verifying disconnection...');
    const verifyResponse = await authAxios.get('/credentials/services/status');
    
    if (verifyResponse.data.success) {
      const updatedServices = verifyResponse.data.data;
      const stillConnectedServices = updatedServices.filter(s => s.hasActiveConnection);
      
      console.log('📊 Updated Status:');
      console.log(`   Total services: ${updatedServices.length}`);
      console.log(`   Connected services: ${stillConnectedServices.length}`);
      
      const disconnectedService = updatedServices.find(s => s.id === serviceToDisconnect.id);
      if (disconnectedService) {
        console.log(`📋 ${serviceToDisconnect.name} Status: ${disconnectedService.actionText} (hasActiveConnection: ${disconnectedService.hasActiveConnection})`);
        
        if (!disconnectedService.hasActiveConnection) {
          console.log(`✅ Verification successful: ${serviceToDisconnect.name} is now disconnected`);
        } else {
          console.log(`❌ Verification failed: ${serviceToDisconnect.name} still appears connected`);
        }
      }
    }

    console.log('\n🎉 Disconnect service test completed!');

  } catch (error) {
    console.error('❌ Test Error:', error.response?.data || error.message);
    console.error('❌ Full error:', error);
  }
}

// Run the test
testDisconnectService();

import axios from 'axios';

async function testGoogleWorkspaceAPI() {
  try {
    console.log('🧪 Testing Google Workspace API endpoints...\n');
    
    const baseURL = 'http://localhost:5000/api';
    
    // Test without auth first
    console.log('1. Testing /users endpoint without auth:');
    try {
      const response = await axios.get(`${baseURL}/integrations/google-workspace/users?companyId=685b09f6dc127b292be3a969`);
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n2. Testing /groups endpoint without auth:');
    try {
      const response = await axios.get(`${baseURL}/integrations/google-workspace/groups?companyId=685b09f6dc127b292be3a969`);
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n3. Testing /connections endpoint without auth:');
    try {
      const response = await axios.get(`${baseURL}/integrations/google-workspace/connections?companyId=685b09f6dc127b292be3a969`);
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.status, error.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGoogleWorkspaceAPI();

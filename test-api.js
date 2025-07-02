const axios = require('axios');

async function testAPI() {
  try {
    console.log('🔍 Testing API connectivity...');
    
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Health check:', healthResponse.data.message);
    console.log('📊 Memory usage:', healthResponse.data.memory);
    
    // Test API root
    const apiResponse = await axios.get('http://localhost:5000/api');
    console.log('✅ API root:', apiResponse.data.message);
    
    console.log('✅ Backend server is running and responding');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running on port 5000');
      console.log('💡 Please start the backend server with: npm run dev');
    } else {
      console.log('❌ API test failed:', error.message);
    }
  }
}

testAPI();

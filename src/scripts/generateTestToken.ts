import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Generate a test token for the company that has Google Workspace data
function generateTestToken() {
  const payload = {
    userId: '685a46c86cfb1d075b73dfe3', // Real user ID from database
    companyId: '685b09f6dc127b292be3a969', // Company ID that has the Google Workspace data
    role: 'COMPANY_ADMIN',
    email: 'burnt776@gmail.com'
  };

  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  const token = jwt.sign(payload, secret, { expiresIn: '24h' });

  console.log('🎫 Generated Test Token:');
  console.log('='.repeat(80));
  console.log(token);
  console.log('='.repeat(80));
  console.log('\n📋 Token Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n🔧 To use this token:');
  console.log('1. Open browser dev tools (F12)');
  console.log('2. Go to Application > Local Storage > http://localhost:3003');
  console.log('3. Set accessToken to the token above');
  console.log('4. Set companyId to: 685b09f6dc127b292be3a969');
  console.log('5. Refresh the page');
  console.log('\n🧪 Test the API with this token:');
  console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:5000/api/integrations/google-workspace/users"`);
  
  return token;
}

generateTestToken();

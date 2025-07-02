const crypto = require('crypto');

// Test the encryption functionality
const algorithm = 'aes-256-gcm';

// Use the same key generation logic as the fixed encryption.ts
const getSecretKey = () => {
  if (process.env.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }
  
  const fallbackKey = crypto.createHash('sha256')
    .update('saas-management-platform-default-key')
    .digest('hex');
  
  console.warn('⚠️  ENCRYPTION_KEY not set in environment variables. Using fallback key.');
  return fallbackKey;
};

const secretKey = getSecretKey();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encryptedData) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey, 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Test encryption/decryption
console.log('🔧 Testing encryption/decryption...');
console.log('Secret key length:', secretKey.length);
console.log('Secret key (first 16 chars):', secretKey.substring(0, 16) + '...');

const testData = 'test-client-secret-12345';
console.log('Original data:', testData);

try {
  const encrypted = encrypt(testData);
  console.log('✅ Encryption successful');
  console.log('Encrypted object keys:', Object.keys(encrypted));
  
  const decrypted = decrypt(encrypted);
  console.log('✅ Decryption successful');
  console.log('Decrypted data:', decrypted);
  console.log('Match:', testData === decrypted ? '✅ YES' : '❌ NO');
} catch (error) {
  console.error('❌ Encryption/Decryption test failed:', error);
}

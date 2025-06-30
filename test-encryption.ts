import dotenv from 'dotenv';
dotenv.config();

import { encrypt, decrypt } from './src/utils/encryption';

console.log('Testing encryption with key from .env...');
console.log('ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);

const testSecret = 'my-secret-access-key';
console.log('\nOriginal:', testSecret);

const encrypted = encrypt(testSecret);
console.log('\nEncrypted:', encrypted);

try {
  const decrypted = decrypt(encrypted);
  console.log('\nDecrypted:', decrypted);
  console.log('\nEncryption test:', decrypted === testSecret ? '✅ PASSED' : '❌ FAILED');
} catch (error: any) {
  console.error('\n❌ Decryption failed:', error.message);
}

import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

// Generate a consistent key if ENCRYPTION_KEY is not set
const getSecretKey = (): string => {
  if (process.env.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }
  
  // Use a deterministic fallback key for development
  // In production, ENCRYPTION_KEY should always be set
  const fallbackKey = crypto.createHash('sha256')
    .update('saas-management-platform-default-key')
    .digest('hex');
  
  console.warn('⚠️  ENCRYPTION_KEY not set in environment variables. Using fallback key. This is not secure for production!');
  return fallbackKey;
};

const secretKey = getSecretKey();

export function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
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

export function decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
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

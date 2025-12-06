import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Use AUTH_SECRET or fallback (but warn in production)
const SECRET_KEY = process.env.AUTH_SECRET || 'default_secret_key_change_me_please';
const IV_LENGTH = 16;

// Ensure key is 32 bytes
const getKey = () => crypto.createHash('sha256').update(SECRET_KEY).digest();

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

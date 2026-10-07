import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET required for encryption');
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a string. Returns "iv:authTag:ciphertext" in hex.
 */
export function encrypt(text) {
  if (!text) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const key = getKey();
    const [ivHex, authTagHex, ciphertext] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

function keyFromSecret(secret: string): Buffer {
  if (secret.length < 32) throw new Error('Encryption secret must contain at least 32 characters');
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function hmacValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function encryptSensitive(value: string, secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    nonce.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join(':');
}

export function decryptSensitive(payload: string, secret: string): string {
  const [version, nonceEncoded, ciphertextEncoded, tagEncoded] = payload.split(':');
  if (version !== 'v1' || !nonceEncoded || !ciphertextEncoded || !tagEncoded) {
    throw new Error('Unsupported encrypted payload');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFromSecret(secret),
    Buffer.from(nonceEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

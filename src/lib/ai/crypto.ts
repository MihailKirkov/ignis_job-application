import 'server-only';

// aes-256-gcm encryption for secrets at rest (the per-user Anthropic API key).
// The key is derived from APP_ENCRYPTION_KEY (any string) via sha-256, so the
// env value can be any length. Ciphertext format: "iv.tag.data" (all base64).
// Server-only — never import from client code; the plaintext key never leaves
// the server.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function derivedKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('APP_ENCRYPTION_KEY is not set; cannot encrypt/decrypt secrets.');
  }
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derivedKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret.');
  }
  const decipher = createDecipheriv('aes-256-gcm', derivedKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

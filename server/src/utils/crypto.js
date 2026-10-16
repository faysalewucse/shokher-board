const crypto = require('crypto');
const config = require('../config');

// AES-256-GCM for secrets we must store and use later (e.g. Slack bot tokens).
// Key: ENCRYPTION_KEY (64 hex chars = 32 bytes). Without it, a key is derived
// from JWT_SECRET so local setup stays zero-config — set a dedicated key in
// production so rotating the JWT secret doesn't make stored tokens unreadable.
const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY;
  if (hex) {
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    return key;
  }
  return crypto.createHash('sha256').update(`enc:${config.jwt.secret}`).digest();
};

/** Encrypt a string → "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
};

/** Decrypt a value produced by encrypt(). Throws if tampered or the key changed. */
const decrypt = (payload) => {
  const [version, iv, tag, data] = String(payload).split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported encrypted payload');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt };

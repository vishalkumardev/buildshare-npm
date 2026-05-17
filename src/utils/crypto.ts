/**
 * Encryption utilities for secure token storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import os from 'os';
import {
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_IV_LENGTH,
  ENCRYPTION_TAG_LENGTH,
} from '../constants';

/**
 * Derives a deterministic encryption key from machine-specific identifiers.
 * This ties the stored tokens to the specific machine for added security.
 */
function deriveKey(): Buffer {
  const machineId = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    os.homedir(),
  ].join(':');

  // Use PBKDF2 to derive a strong key from the machine identifier
  const salt = Buffer.from('buildshare-cli-salt-v1', 'utf-8');
  return crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
export function decrypt(encryptedText: string): string {
  const key = deriveKey();

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  if (iv.length !== ENCRYPTION_IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  if (authTag.length !== ENCRYPTION_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}

/**
 * Generate file checksum using SHA-256
 */
export function computeChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate checksum for a stream/chunk
 */
export function computeChunkChecksum(chunk: Buffer): string {
  return crypto.createHash('md5').update(chunk).digest('hex');
}

/**
 * File utility functions for BuildShare CLI
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { ANDROID_EXTENSIONS, IOS_EXTENSIONS, MAX_FILE_SIZE } from '../constants';
import { ValidationError } from './errors';
import { logger } from './logger';

/**
 * Validate that a file exists and is accessible
 */
export function validateFileExists(filePath: string): string {
  const resolved = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolved)) {
    throw new ValidationError(`File not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new ValidationError(`Path is not a file: ${resolved}`);
  }

  return resolved;
}

/**
 * Validate file size is within limits
 */
export function validateFileSize(filePath: string): number {
  const stat = fs.statSync(filePath);

  if (stat.size === 0) {
    throw new ValidationError('File is empty');
  }

  if (stat.size > MAX_FILE_SIZE) {
    throw new ValidationError(
      `File size (${formatBytes(stat.size)}) exceeds maximum allowed size (${formatBytes(MAX_FILE_SIZE)})`
    );
  }

  return stat.size;
}

/**
 * Detect file type from extension
 */
export function detectFileType(filePath: string): 'apk' | 'aab' | 'ipa' {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.apk') return 'apk';
  if (ext === '.aab') return 'aab';
  if (ext === '.ipa') return 'ipa';

  throw new ValidationError(
    `Unsupported file type: ${ext}. Supported types: .apk, .aab, .ipa`
  );
}

/**
 * Validate a file is a valid Android build
 */
export function validateAndroidFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  if (!ANDROID_EXTENSIONS.includes(ext)) {
    throw new ValidationError(
      `Invalid Android build file. Expected .apk or .aab, got ${ext}`
    );
  }

  return validateFileExists(filePath);
}

/**
 * Validate a file is a valid iOS build
 */
export function validateIosFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  if (!IOS_EXTENSIONS.includes(ext)) {
    throw new ValidationError(
      `Invalid iOS build file. Expected .ipa, got ${ext}`
    );
  }

  return validateFileExists(filePath);
}

/**
 * Compute SHA-256 checksum of a file
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Find build files in a directory by extension
 */
export function findBuildFiles(dirPath: string, extensions: string[]): string[] {
  const resolved = path.resolve(process.cwd(), dirPath);

  if (!fs.existsSync(resolved)) {
    return [];
  }

  try {
    const files = fs.readdirSync(resolved);
    return files
      .filter((f) => extensions.includes(path.extname(f).toLowerCase()))
      .map((f) => path.join(resolved, f));
  } catch {
    logger.debug(`Failed to read directory: ${resolved}`);
    return [];
  }
}

/**
 * Sanitize file path to prevent path traversal
 */
export function sanitizePath(inputPath: string): string {
  const normalized = path.normalize(inputPath);

  // Prevent path traversal
  if (normalized.includes('..')) {
    throw new ValidationError('Path traversal detected. Unsafe path rejected.');
  }

  return normalized;
}

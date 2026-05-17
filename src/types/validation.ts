/**
 * Zod validation schemas for BuildShare CLI
 */

import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const loginCredentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const apiTokenSchema = z.object({
  token: z.string().min(10, 'API token must be at least 10 characters'),
});

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().positive(),
});

// ─── Project Config Schema ───────────────────────────────────────────────────

export const projectConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  projectName: z.string().min(1, 'Project name is required'),
  androidPath: z.string().default(''),
  iosPath: z.string().default(''),
  defaultBranch: z.string().default('main'),
});

// ─── Upload Schemas ──────────────────────────────────────────────────────────

export const uploadRequestSchema = z.object({
  projectId: z.string().min(1),
  platform: z.enum(['android', 'ios']),
  fileType: z.enum(['apk', 'aab', 'ipa']),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  checksum: z.string().min(1),
  changelog: z.string().min(1, 'Changelog is required'),
  releaseType: z.enum(['development', 'staging', 'production']),
  branch: z.string().optional(),
  commitHash: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const releaseTypeSchema = z.enum(['development', 'staging', 'production']);

// ─── App Config Schema ──────────────────────────────────────────────────────

export const appConfigSchema = z.object({
  apiUrl: z.string().url('Invalid API URL'),
  apiVersion: z.string().default('v1'),
  debug: z.boolean().default(false),
  verbose: z.boolean().default(false),
  chunkSize: z.number().min(1048576).default(5242880), // min 1MB, default 5MB
  maxRetries: z.number().min(0).max(10).default(3),
  parallelChunks: z.number().min(1).max(10).default(3),
  uploadTimeout: z.number().min(30000).default(300000),
  ci: z.boolean().default(false),
  apiToken: z.string().optional(),
});

// ─── File Path Schema ────────────────────────────────────────────────────────

export const filePathSchema = z.string().refine(
  (val) => {
    // Prevent path traversal attacks
    const normalized = val.replace(/\\/g, '/');
    return !normalized.includes('../') && !normalized.includes('..\\');
  },
  { message: 'Path traversal detected. Use absolute or relative paths without "..".' }
);

// ─── Type Inference ──────────────────────────────────────────────────────────

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type ApiToken = z.infer<typeof apiTokenSchema>;
export type ProjectConfigInput = z.infer<typeof projectConfigSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type AppConfigInput = z.infer<typeof appConfigSchema>;

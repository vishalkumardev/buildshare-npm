/**
 * Core type definitions for BuildShare CLI
 */

// ─── Authentication ──────────────────────────────────────────────────────────

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  organization?: string;
}

export interface StoredAuth {
  tokens: AuthTokens;
  user: UserProfile;
  encryptedAt: number;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  androidPath: string;
  iosPath: string;
  defaultBranch: string;
}

export interface Project {
  appId: string;
  name: string;
  packageName: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  organization?: {
    organizationId: string;
    name: string;
  };
}

export interface AppListResponse {
  records: Project[];
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
  prevPage: number | null;
}

// ─── Build / Upload ──────────────────────────────────────────────────────────

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios',
}

export enum FileType {
  APK = 'apk',
  AAB = 'aab',
  IPA = 'ipa',
}



// ─── Upload Engine ───────────────────────────────────────────────────────────

export interface UploadConfig {
  chunkSize: number;
  maxRetries: number;
  parallelChunks: number;
  timeout: number;
}

export interface UploadProgress {
  uploadId: string;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  currentChunk: number;
  totalChunks: number;
  status: UploadStatus;
}

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PAUSED = 'paused',
  RETRYING = 'retrying',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  checksum: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retries: number;
}

export interface UploadState {
  uploadId: string;
  filePath: string;
  fileSize: number;
  fileChecksum: string;
  startedAt: number;
  lastActivity: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  apiUrl: string;
  apiVersion: string;
  debug: boolean;
  verbose: boolean;
  chunkSize: number;
  maxRetries: number;
  parallelChunks: number;
  uploadTimeout: number;
  ci: boolean;
  apiToken?: string;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

// ─── Doctor ──────────────────────────────────────────────────────────────────

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
}

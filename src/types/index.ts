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
  success: boolean;
  data: {
    tokens: AuthTokens;
    user: UserProfile;
  };
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
  id: string;
  name: string;
  platform: Platform[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  success: boolean;
  data: {
    projects: Project[];
    total: number;
  };
}

export interface ProjectCreateResponse {
  success: boolean;
  data: {
    project: Project;
  };
}

// ─── Build / Upload ──────────────────────────────────────────────────────────

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios',
}

export enum ReleaseType {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum FileType {
  APK = 'apk',
  AAB = 'aab',
  IPA = 'ipa',
}

export interface UploadInitiateRequest {
  projectId: string;
  platform: Platform;
  fileType: FileType;
  fileName: string;
  fileSize: number;
  checksum: string;
  changelog: string;
  releaseType: ReleaseType;
  branch?: string;
  commitHash?: string;
  metadata?: Record<string, string>;
}

export interface UploadInitiateResponse {
  success: boolean;
  data: {
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
    uploadUrls?: string[];
  };
}

export interface ChunkUploadRequest {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: string;
}

export interface ChunkUploadResponse {
  success: boolean;
  data: {
    chunkIndex: number;
    received: boolean;
  };
}

export interface UploadCompleteRequest {
  uploadId: string;
  checksums: string[];
  totalChunks: number;
}

export interface UploadCompleteResponse {
  success: boolean;
  data: {
    buildId: string;
    version: string;
    downloadUrl: string;
    installUrl: string;
    qrCodeUrl: string;
    manifestUrl?: string;
  };
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
  chunks: ChunkInfo[];
  completedChunks: number[];
  config: UploadConfig;
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

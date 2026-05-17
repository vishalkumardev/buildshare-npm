import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import FormData from 'form-data';
import { apiClient } from '../api/client';
import { configManager } from '../config';
import { API_ENDPOINTS } from '../constants';
import {
  UploadConfig,
  UploadProgress,
  UploadStatus,
  FileType,
  Platform,
} from '../types';
import { UploadError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface UploadOptions {
  filePath: string;
  projectId: string;
  platform: Platform;
  fileType: FileType;
  changelog: string;
  branch?: string;
  commitHash?: string;
  metadata?: Record<string, string>;
  versionName?: string;
  versionCode?: string;
}

export interface UploadResult {
  versionId: string;
  appId: string;
  versionName: string;
  versionCode: number;
  changelog: string;
  apkUrl: string;
}

type UploadEventMap = {
  progress: [UploadProgress];
  complete: [UploadResult];
  error: [Error];
  paused: [];
  resumed: [];
  cancelled: [];
  chunk_retry: [{ index: number; attempt: number; maxRetries: number }];
};

export class UploadEngine extends EventEmitter {
  private config: UploadConfig;
  private isCancelled = false;
  private startTime = 0;
  private uploadedBytes = 0;
  private totalBytes = 0;
  private activeUploads = new Map<number, AbortController>();

  constructor(config?: Partial<UploadConfig>) {
    super();

    const appConfig = configManager.getConfig();
    this.config = {
      chunkSize: config?.chunkSize || appConfig.chunkSize,
      maxRetries: config?.maxRetries || appConfig.maxRetries,
      parallelChunks: config?.parallelChunks || appConfig.parallelChunks,
      timeout: config?.timeout || appConfig.uploadTimeout,
    };
  }

  // Typed emit
  emit<K extends keyof UploadEventMap>(event: K, ...args: UploadEventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  // Typed on
  on<K extends keyof UploadEventMap>(event: K, listener: (...args: UploadEventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Upload a file with single request strategy
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { filePath, projectId, platform, fileType, changelog, versionName, versionCode } = options;

    this.isCancelled = false;
    this.startTime = Date.now();

    const fileStats = await fs.stat(filePath);
    this.totalBytes = fileStats.size;
    this.uploadedBytes = 0;

    const fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(fileStats.size);
    await fs.read(fd, buffer, 0, fileStats.size, 0);
    await fs.close(fd);

    const formData = new FormData();
    formData.append('versionName', versionName || '1.0.0');
    formData.append('versionCode', versionCode || '1');
    formData.append('changelog', changelog || '');

    const fileKey = fileType === 'apk' || fileType === 'aab' ? 'apk' : (fileType === 'ipa' ? 'ipa' : 'file');
    formData.append(fileKey, buffer, {
      filename: path.basename(filePath),
      contentType: platform === 'android' ? 'application/vnd.android.package-archive' : 'application/octet-stream',
    });

    const headers = formData.getHeaders ? formData.getHeaders() : { 'Content-Type': 'multipart/form-data' };

    const controller = new AbortController();
    this.activeUploads.set(0, controller);

    try {
      const response = await apiClient.uploadChunk(
        API_ENDPOINTS.BUILDS.UPLOAD(projectId),
        formData as unknown as Buffer,
        headers,
        (loaded, total) => {
          this.uploadedBytes = loaded;
          this.totalBytes = total || this.totalBytes;
          this.emitProgress();
        },
        this.config.timeout
      );

      this.activeUploads.delete(0);

      if (this.isCancelled) {
        throw new UploadError('Upload was cancelled', '');
      }

      const data = response.data as any;

      const result: UploadResult = {
        versionId: data?.versionId || '',
        appId: data?.appId || '',
        versionName: data?.versionName || '',
        versionCode: data?.versionCode || 0,
        changelog: data?.changelog || '',
        apkUrl: data?.apkUrl || '',
      };

      this.emit('complete', result);
      return result;
    } catch (error) {
      this.activeUploads.delete(0);
      throw error;
    }
  }

  cancel(): void {
    this.isCancelled = true;
    for (const [, controller] of this.activeUploads) {
      controller.abort();
    }
    this.activeUploads.clear();
    this.emit('cancelled');
    logger.info('Upload cancelled');
  }

  private emitProgress(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.uploadedBytes / elapsed : 0;
    const remaining = this.totalBytes - this.uploadedBytes;
    const eta = speed > 0 ? remaining / speed : 0;

    const progress: UploadProgress = {
      uploadId: '',
      totalBytes: this.totalBytes,
      uploadedBytes: this.uploadedBytes,
      percentage: Math.min((this.uploadedBytes / this.totalBytes) * 100, 100),
      speed,
      eta,
      currentChunk: 1,
      totalChunks: 1,
      status: this.isCancelled ? UploadStatus.CANCELLED : UploadStatus.UPLOADING,
    };

    this.emit('progress', progress);
  }
}

export function createUploadEngine(config?: Partial<UploadConfig>): UploadEngine {
  return new UploadEngine(config);
}

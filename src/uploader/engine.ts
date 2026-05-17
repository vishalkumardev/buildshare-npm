/**
 * Upload Engine
 * Production-grade chunked upload with retry, parallel uploads,
 * checksum verification, pause/resume, and cancellation support
 */

import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import FormData from 'form-data';
import { apiClient } from '../api/client';
import { configManager } from '../config';
import { API_ENDPOINTS, PROJECT_DIR, UPLOAD_STATE_DIR } from '../constants';
import {
  UploadConfig,
  UploadProgress,
  UploadStatus,
  UploadState,
  ChunkInfo,
  UploadInitiateRequest,
  UploadInitiateResponse,

  UploadCompleteResponse,
  FileType,
  Platform,
  ReleaseType,
} from '../types';
import { computeChunkChecksum } from '../utils/crypto';
import { computeFileChecksum } from '../utils/file';
import { UploadError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface UploadOptions {
  filePath: string;
  projectId: string;
  platform: Platform;
  fileType: FileType;
  changelog: string;
  releaseType: ReleaseType;
  branch?: string;
  commitHash?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  buildId: string;
  version: string;
  downloadUrl: string;
  installUrl: string;
  qrCodeUrl: string;
  manifestUrl?: string;
}

type UploadEventMap = {
  progress: [UploadProgress];
  chunk_complete: [{ index: number; total: number }];
  chunk_retry: [{ index: number; attempt: number; maxRetries: number }];
  complete: [UploadResult];
  error: [Error];
  paused: [];
  resumed: [];
  cancelled: [];
};

export class UploadEngine extends EventEmitter {
  private config: UploadConfig;
  private state: UploadState | null = null;
  private isPaused = false;
  private isCancelled = false;
  private activeUploads = new Map<number, AbortController>();
  private startTime = 0;
  private uploadedBytes = 0;
  private totalBytes = 0;

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
   * Upload a file with chunked upload strategy
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { filePath, projectId, platform, fileType, changelog, releaseType, branch, commitHash, metadata } = options;

    this.isCancelled = false;
    this.isPaused = false;
    this.startTime = Date.now();

    // 1. Compute file checksum
    logger.debug('Computing file checksum...');
    const fileChecksum = await computeFileChecksum(filePath);
    const fileStats = await fs.stat(filePath);
    this.totalBytes = fileStats.size;

    // 2. Check for resumable upload
    const savedState = await this.loadUploadState(filePath);
    if (savedState && savedState.fileChecksum === fileChecksum) {
      logger.info('Found previous upload state. Resuming...');
      this.state = savedState;
      this.uploadedBytes = this.calculateUploadedBytes(savedState);
    } else {
      // 3. Initiate upload with the server
      const initiateRequest: UploadInitiateRequest = {
        projectId,
        platform,
        fileType,
        fileName: path.basename(filePath),
        fileSize: fileStats.size,
        checksum: fileChecksum,
        changelog,
        releaseType,
        branch,
        commitHash,
        metadata,
      };

      const initiateResponse = await apiClient.post<UploadInitiateResponse['data']>(
        API_ENDPOINTS.BUILDS.UPLOAD_INITIATE,
        initiateRequest
      );

      const { uploadId, chunkSize } = initiateResponse.data;

      // 4. Build chunk manifest
      const effectiveChunkSize = chunkSize || this.config.chunkSize;
      const chunks = this.buildChunkManifest(filePath, fileStats.size, effectiveChunkSize);

      this.state = {
        uploadId,
        filePath,
        fileSize: fileStats.size,
        fileChecksum,
        chunks,
        completedChunks: [],
        config: this.config,
        startedAt: Date.now(),
        lastActivity: Date.now(),
      };

      this.uploadedBytes = 0;
    }

    // 5. Upload chunks
    await this.uploadChunks();

    // 6. Complete the upload
    if (this.isCancelled) {
      throw new UploadError('Upload was cancelled', this.state.uploadId);
    }

    const result = await this.completeUpload();

    // 7. Clean up state file
    await this.clearUploadState(filePath);

    return result;
  }

  /**
   * Pause the upload
   */
  pause(): void {
    this.isPaused = true;
    // Cancel active chunk uploads
    for (const [, controller] of this.activeUploads) {
      controller.abort();
    }
    this.activeUploads.clear();
    this.emit('paused');
    logger.info('Upload paused');
  }

  /**
   * Resume the upload
   */
  resume(): void {
    this.isPaused = false;
    this.emit('resumed');
    logger.info('Upload resumed');
  }

  /**
   * Cancel the upload
   */
  cancel(): void {
    this.isCancelled = true;
    this.isPaused = false;
    for (const [, controller] of this.activeUploads) {
      controller.abort();
    }
    this.activeUploads.clear();
    this.emit('cancelled');
    logger.info('Upload cancelled');
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Build the chunk manifest for the file
   */
  private buildChunkManifest(_filePath: string, fileSize: number, chunkSize: number): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(fileSize / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);

      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        checksum: '', // computed during upload
        status: 'pending',
        retries: 0,
      });
    }

    return chunks;
  }

  /**
   * Upload all chunks with parallel execution
   */
  private async uploadChunks(): Promise<void> {
    if (!this.state) throw new UploadError('Upload state not initialized');

    const pendingChunks = this.state.chunks.filter(
      (c) => c.status !== 'completed'
    );

    // Process chunks in parallel batches
    const batchSize = this.config.parallelChunks;

    for (let i = 0; i < pendingChunks.length; i += batchSize) {
      if (this.isCancelled) return;

      // Wait while paused
      while (this.isPaused) {
        await this.saveUploadState();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (this.isCancelled) return;
      }

      const batch = pendingChunks.slice(i, i + batchSize);
      await Promise.all(batch.map((chunk) => this.uploadSingleChunk(chunk)));

      // Save state after each batch
      await this.saveUploadState();
    }
  }

  /**
   * Upload a single chunk with retry logic
   */
  private async uploadSingleChunk(chunk: ChunkInfo): Promise<void> {
    if (!this.state) return;

    while (chunk.retries <= this.config.maxRetries) {
      if (this.isCancelled || this.isPaused) return;

      try {
        chunk.status = 'uploading';

        // Read chunk data from file
        const fd = await fs.open(this.state.filePath, 'r');
        const buffer = Buffer.alloc(chunk.size);
        await fs.read(fd, buffer, 0, chunk.size, chunk.start);
        await fs.close(fd);

        // Compute chunk checksum
        chunk.checksum = computeChunkChecksum(buffer);

        // Create abort controller for cancellation
        const controller = new AbortController();
        this.activeUploads.set(chunk.index, controller);

        // Build form data
        const formData = new FormData();
        formData.append('file', buffer, {
          filename: `chunk_${chunk.index}`,
          contentType: 'application/octet-stream',
        });
        formData.append('uploadId', this.state.uploadId);
        formData.append('chunkIndex', chunk.index.toString());
        formData.append('totalChunks', this.state.chunks.length.toString());
        formData.append('checksum', chunk.checksum);

        const headers = formData.getHeaders ? formData.getHeaders() : { 'Content-Type': 'multipart/form-data' };

        await apiClient.uploadChunk(
          API_ENDPOINTS.BUILDS.UPLOAD_CHUNK,
          formData as unknown as Buffer,
          headers,
          (loaded, _total) => {
            this.updateProgress(chunk.index, loaded);
          },
          this.config.timeout
        );

        // Success
        chunk.status = 'completed';
        this.state.completedChunks.push(chunk.index);
        this.uploadedBytes += chunk.size;
        this.activeUploads.delete(chunk.index);

        this.emit('chunk_complete', {
          index: chunk.index,
          total: this.state.chunks.length,
        });

        this.emitProgress();
        return;
      } catch (error) {
        this.activeUploads.delete(chunk.index);

        if (this.isCancelled || this.isPaused) return;

        chunk.retries++;
        chunk.status = 'failed';

        if (chunk.retries <= this.config.maxRetries) {
          this.emit('chunk_retry', {
            index: chunk.index,
            attempt: chunk.retries,
            maxRetries: this.config.maxRetries,
          });

          logger.debug(
            `Chunk ${chunk.index} failed, retrying (${chunk.retries}/${this.config.maxRetries})...`
          );

          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, chunk.retries - 1), 30000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new UploadError(
            `Failed to upload chunk ${chunk.index} after ${this.config.maxRetries} retries`,
            this.state?.uploadId,
            chunk.index
          );
        }
      }
    }
  }

  /**
   * Complete the upload on the server
   */
  private async completeUpload(): Promise<UploadResult> {
    if (!this.state) throw new UploadError('Upload state not initialized');

    const checksums = this.state.chunks
      .sort((a, b) => a.index - b.index)
      .map((c) => c.checksum);

    const response = await apiClient.post<UploadCompleteResponse['data']>(
      API_ENDPOINTS.BUILDS.UPLOAD_COMPLETE,
      {
        uploadId: this.state.uploadId,
        checksums,
        totalChunks: this.state.chunks.length,
      }
    );

    const result: UploadResult = {
      buildId: response.data.buildId,
      version: response.data.version,
      downloadUrl: response.data.downloadUrl,
      installUrl: response.data.installUrl,
      qrCodeUrl: response.data.qrCodeUrl,
      manifestUrl: response.data.manifestUrl,
    };

    this.emit('complete', result);
    return result;
  }

  /**
   * Emit progress event
   */
  private emitProgress(): void {
    if (!this.state) return;

    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.uploadedBytes / elapsed : 0;
    const remaining = this.totalBytes - this.uploadedBytes;
    const eta = speed > 0 ? remaining / speed : 0;

    const progress: UploadProgress = {
      uploadId: this.state.uploadId,
      totalBytes: this.totalBytes,
      uploadedBytes: this.uploadedBytes,
      percentage: Math.min((this.uploadedBytes / this.totalBytes) * 100, 100),
      speed,
      eta,
      currentChunk: this.state.completedChunks.length,
      totalChunks: this.state.chunks.length,
      status: this.isPaused
        ? UploadStatus.PAUSED
        : this.isCancelled
        ? UploadStatus.CANCELLED
        : UploadStatus.UPLOADING,
    };

    this.emit('progress', progress);
  }

  /**
   * Update progress for partial chunk uploads
   */
  private updateProgress(_chunkIndex: number, _loaded: number): void {
    this.emitProgress();
  }

  /**
   * Calculate total bytes already uploaded from saved state
   */
  private calculateUploadedBytes(state: UploadState): number {
    return state.chunks
      .filter((c) => c.status === 'completed')
      .reduce((sum, c) => sum + c.size, 0);
  }

  // ─── Upload State Persistence ───────────────────────────────────────

  /**
   * Get the state file path for a given file
   */
  private getStateFilePath(filePath: string): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(filePath)
      .digest('hex')
      .substring(0, 8);
    const stateDir = path.join(process.cwd(), PROJECT_DIR, UPLOAD_STATE_DIR);
    return path.join(stateDir, `${hash}.json`);
  }

  /**
   * Save upload state for resume capability
   */
  private async saveUploadState(): Promise<void> {
    if (!this.state) return;

    const stateFile = this.getStateFilePath(this.state.filePath);
    await fs.ensureDir(path.dirname(stateFile));

    this.state.lastActivity = Date.now();
    await fs.writeJSON(stateFile, this.state, { spaces: 2 });

    logger.debug('Upload state saved');
  }

  /**
   * Load upload state for resume
   */
  private async loadUploadState(filePath: string): Promise<UploadState | null> {
    const stateFile = this.getStateFilePath(filePath);

    if (!await fs.pathExists(stateFile)) {
      return null;
    }

    try {
      const state: UploadState = await fs.readJSON(stateFile);

      // Check if state is too old (24 hours)
      if (Date.now() - state.lastActivity > 24 * 60 * 60 * 1000) {
        logger.debug('Upload state expired, starting fresh');
        await fs.remove(stateFile);
        return null;
      }

      return state;
    } catch {
      logger.debug('Failed to load upload state');
      return null;
    }
  }

  /**
   * Clear upload state after completion
   */
  private async clearUploadState(filePath: string): Promise<void> {
    const stateFile = this.getStateFilePath(filePath);
    if (await fs.pathExists(stateFile)) {
      await fs.remove(stateFile);
    }
  }
}

/**
 * Factory function for creating upload engine instances
 */
export function createUploadEngine(config?: Partial<UploadConfig>): UploadEngine {
  return new UploadEngine(config);
}

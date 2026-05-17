/**
 * Configuration Manager
 * Handles app config, environment variables, and project configuration
 */

import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { AppConfig, ProjectConfig } from '../types';
import {
  CONFIG_DIR,
  SETTINGS_FILE,
  PROJECT_DIR,
  PROJECT_CONFIG_FILE,
  DEFAULT_API_URL,
  DEFAULT_API_VERSION,
  DEFAULT_CHUNK_SIZE,
  MAX_RETRIES,
  PARALLEL_CHUNKS,
  UPLOAD_TIMEOUT,
} from '../constants';
import { appConfigSchema, projectConfigSchema } from '../types/validation';
import { ConfigError } from '../utils/errors';
import { logger } from '../utils/logger';

class ConfigManager {
  private appConfig: AppConfig | null = null;

  /**
   * Initialize and load application configuration
   */
  async initialize(): Promise<AppConfig> {
    // Load .env file if it exists
    dotenv.config();

    // Ensure config directory exists
    await fs.ensureDir(CONFIG_DIR);

    // Build config from environment and defaults
    const rawConfig = {
      apiUrl: process.env.BUILDSHARE_API_URL || DEFAULT_API_URL,
      apiVersion: process.env.BUILDSHARE_API_VERSION || DEFAULT_API_VERSION,
      debug: process.env.BUILDSHARE_DEBUG === 'true',
      verbose: process.env.BUILDSHARE_VERBOSE === 'true',
      chunkSize: parseInt(process.env.BUILDSHARE_CHUNK_SIZE || '', 10) || DEFAULT_CHUNK_SIZE,
      maxRetries: parseInt(process.env.BUILDSHARE_MAX_RETRIES || '', 10) || MAX_RETRIES,
      parallelChunks: parseInt(process.env.BUILDSHARE_PARALLEL_CHUNKS || '', 10) || PARALLEL_CHUNKS,
      uploadTimeout: parseInt(process.env.BUILDSHARE_UPLOAD_TIMEOUT || '', 10) || UPLOAD_TIMEOUT,
      ci: process.env.BUILDSHARE_CI === 'true' || process.env.CI === 'true',
      apiToken: process.env.BUILDSHARE_API_TOKEN || undefined,
    };

    // Validate config
    const result = appConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      throw new ConfigError(
        `Invalid configuration: ${result.error.errors.map((e) => e.message).join(', ')}`,
        'Check your environment variables and .env file.'
      );
    }

    this.appConfig = result.data;

    // Configure logger
    logger.setDebug(this.appConfig.debug);
    logger.setVerbose(this.appConfig.verbose);

    logger.debug('Configuration loaded', this.appConfig as unknown as Record<string, unknown>);

    return this.appConfig;
  }

  /**
   * Get the current app configuration
   */
  getConfig(): AppConfig {
    if (!this.appConfig) {
      throw new ConfigError('Configuration not initialized. Call initialize() first.');
    }
    return this.appConfig;
  }

  /**
   * Check if running in CI mode
   */
  isCI(): boolean {
    return this.appConfig?.ci || false;
  }

  // ─── Project Configuration ──────────────────────────────────────────

  /**
   * Get the project config directory path
   */
  getProjectConfigDir(): string {
    return path.join(process.cwd(), PROJECT_DIR);
  }

  /**
   * Get the project config file path
   */
  getProjectConfigPath(): string {
    return path.join(this.getProjectConfigDir(), PROJECT_CONFIG_FILE);
  }

  /**
   * Check if project is initialized in the current directory
   */
  isProjectInitialized(): boolean {
    return fs.existsSync(this.getProjectConfigPath());
  }

  /**
   * Read project configuration
   */
  async readProjectConfig(): Promise<ProjectConfig> {
    const configPath = this.getProjectConfigPath();

    if (!fs.existsSync(configPath)) {
      throw new ConfigError(
        'No BuildShare project found in the current directory.',
        'Run "buildshare init" to initialize a project.'
      );
    }

    try {
      const raw = await fs.readJSON(configPath);
      const result = projectConfigSchema.safeParse(raw);

      if (!result.success) {
        throw new ConfigError(
          `Invalid project config: ${result.error.errors.map((e) => e.message).join(', ')}`,
          'Run "buildshare init" to reinitialize the project.'
        );
      }

      return result.data as ProjectConfig;
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError(
        'Failed to read project configuration.',
        'The project.json file may be corrupted. Run "buildshare init" to reinitialize.'
      );
    }
  }

  /**
   * Write project configuration
   */
  async writeProjectConfig(config: ProjectConfig): Promise<void> {
    const configDir = this.getProjectConfigDir();
    const configPath = this.getProjectConfigPath();

    await fs.ensureDir(configDir);
    await fs.writeJSON(configPath, config, { spaces: 2 });

    logger.debug('Project config written', { path: configPath });
  }

  /**
   * Save settings to the global config directory
   */
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJSON(SETTINGS_FILE, settings, { spaces: 2 });
  }

  /**
   * Read global settings
   */
  async readSettings(): Promise<Record<string, unknown>> {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return {};
    }
    return fs.readJSON(SETTINGS_FILE);
  }
}

// Singleton export
export const configManager = new ConfigManager();

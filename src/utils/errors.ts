/**
 * Custom error classes for BuildShare CLI
 */

import { EXIT_CODES } from '../constants';

export class BuildShareError extends Error {
  public readonly exitCode: number;
  public readonly suggestion?: string;

  constructor(message: string, exitCode: number = EXIT_CODES.GENERAL_ERROR, suggestion?: string) {
    super(message);
    this.name = 'BuildShareError';
    this.exitCode = exitCode;
    this.suggestion = suggestion;
  }
}

export class AuthenticationError extends BuildShareError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      EXIT_CODES.AUTH_ERROR,
      suggestion || 'Try running "buildshare login" to authenticate.'
    );
    this.name = 'AuthenticationError';
  }
}

export class ConfigError extends BuildShareError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      EXIT_CODES.CONFIG_ERROR,
      suggestion || 'Try running "buildshare init" to set up your project.'
    );
    this.name = 'ConfigError';
  }
}

export class UploadError extends BuildShareError {
  public readonly uploadId?: string;
  public readonly chunkIndex?: number;

  constructor(message: string, uploadId?: string, chunkIndex?: number, suggestion?: string) {
    super(
      message,
      EXIT_CODES.UPLOAD_ERROR,
      suggestion || 'Check your network connection and try again.'
    );
    this.name = 'UploadError';
    this.uploadId = uploadId;
    this.chunkIndex = chunkIndex;
  }
}

export class NetworkError extends BuildShareError {
  public readonly statusCode?: number;
  public readonly responseData?: unknown;

  constructor(message: string, statusCode?: number, responseData?: unknown) {
    super(
      message,
      EXIT_CODES.NETWORK_ERROR,
      'Check your internet connection and API configuration.'
    );
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}

export class ValidationError extends BuildShareError {
  public readonly field?: string;
  public readonly errors?: Array<{ field?: string; message: string }>;

  constructor(message: string, errors?: Array<{ field?: string; message: string }>) {
    super(message, EXIT_CODES.VALIDATION_ERROR);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Global error handler
 */
export function handleError(error: unknown): never {
  if (error instanceof BuildShareError) {
    const chalk = require('chalk');
    console.error(`\n${chalk.red('✖')} ${chalk.red.bold(error.name)}: ${error.message}`);

    if (error instanceof ValidationError && error.errors) {
      for (const err of error.errors) {
        console.error(chalk.red(`  → ${err.field ? `${err.field}: ` : ''}${err.message}`));
      }
    }

    if (error.suggestion) {
      console.error(`\n${chalk.yellow('💡 Suggestion:')} ${error.suggestion}\n`);
    }

    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    const chalk = require('chalk');
    console.error(`\n${chalk.red('✖')} ${chalk.red.bold('Unexpected Error')}: ${error.message}`);

    if (process.env.BUILDSHARE_DEBUG === 'true') {
      console.error(chalk.gray(error.stack));
    }

    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  console.error('An unknown error occurred');
  process.exit(EXIT_CODES.GENERAL_ERROR);
}

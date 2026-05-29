/**
 * Upload Command — Android and iOS build uploads with progress
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import cliProgress from 'cli-progress';
import { configManager } from '../config';
import { apiClient } from '../api/client';
import { authManager } from '../services/auth';
import { createUploadEngine, UploadResult } from '../uploader';
import { Platform, FileType } from '../types';
import { ANDROID_EXTENSIONS, IOS_EXTENSIONS } from '../constants';
import { handleError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { validateFileSize, validateAndroidFile, validateIosFile, detectFileType, formatBytes, formatDuration, findBuildFiles } from '../utils/file';
import { getCurrentBranch, getCommitHash, getLatestCommitMessage } from '../utils/git';
import { promptChangelogInline, promptConfirmUpload, promptSelectBuildFile } from '../prompts';

interface UploadCmdOpts {
  file?: string;
  changelog?: string;
  branch?: string;
  commit?: string;
  confirm?: boolean;
  versionName?: string;
  versionCode?: string;
}

export function createUploadCommand(): Command {
  const cmd = new Command('upload').description('Upload a build to BuildShare');

  cmd.command('android').description('Upload Android APK/AAB')
    .option('-f, --file <path>', 'Path to APK/AAB')
    .option('-c, --changelog <msg>', 'Changelog')
    .option('--branch <branch>', 'Git branch')
    .option('--commit <hash>', 'Git commit')
    .option('--no-confirm', 'Skip confirmation')
    .action(async (opts) => { try { await performUpload(Platform.ANDROID, opts); } catch (e) { handleError(e); } });

  cmd.command('ios').description('Upload iOS IPA')
    .option('-f, --file <path>', 'Path to IPA')
    .option('-c, --changelog <msg>', 'Changelog')
    .option('--branch <branch>', 'Git branch')
    .option('--commit <hash>', 'Git commit')
    .option('--no-confirm', 'Skip confirmation')
    .action(async (opts) => { try { await performUpload(Platform.IOS, opts); } catch (e) { handleError(e); } });

  return cmd;
}

async function performUpload(platform: Platform, options: UploadCmdOpts): Promise<void> {
  await configManager.initialize();
  apiClient.initialize();
  await authManager.requireAuth();
  const projectConfig = await configManager.readProjectConfig();

  logger.newline();
  logger.info(`Preparing ${platform === Platform.ANDROID ? '🤖 Android' : '🍎 iOS'} upload...`);
  logger.divider();

  // Resolve file
  let filePath = options.file || (platform === Platform.ANDROID ? projectConfig.androidPath : projectConfig.iosPath);
  if (!filePath) throw new ValidationError(`No ${platform} build path configured.`, [{ message: `Set path in .buildshare/project.json or use --file` }]);

  const spinner = ora('Validating build file...').start();

  if (require('fs-extra').existsSync(filePath) && require('fs-extra').statSync(filePath).isDirectory()) {
    const exts = platform === Platform.ANDROID ? ANDROID_EXTENSIONS : IOS_EXTENSIONS;
    const files = findBuildFiles(filePath, exts);
    if (files.length === 0) {
      spinner.fail('Validation failed');
      throw new ValidationError(`No ${platform} build files (${exts.join(', ')}) found in directory: ${filePath}`);
    } else if (files.length === 1) {
      filePath = files[0];
    } else {
      spinner.stop();
      filePath = await promptSelectBuildFile(files);
      spinner.start('Validating build file...');
    }
  }

  const resolved = platform === Platform.ANDROID ? validateAndroidFile(filePath) : validateIosFile(filePath);
  const fileSize = validateFileSize(resolved);
  const fileType = detectFileType(resolved) as FileType;
  const fileName = path.basename(resolved);
  spinner.succeed(`Build file: ${chalk.bold(fileName)} (${formatBytes(fileSize)})`);

  // Changelog
  let changelog = options.changelog || (configManager.isCI() ? (getLatestCommitMessage() || 'Automated build') : await promptChangelogInline());

  const branch = options.branch || getCurrentBranch() || projectConfig.defaultBranch;
  const commitHash = options.commit || getCommitHash() || undefined;

  const versionName = options.versionName;
  const versionCode = options.versionCode;

  // Confirm
  if (options.confirm !== false && !configManager.isCI()) {
    logger.newline();
    logger.table({ File: fileName, Size: formatBytes(fileSize), Type: fileType.toUpperCase(), Branch: branch, Commit: commitHash || 'N/A' });
    if (!(await promptConfirmUpload(fileName, formatBytes(fileSize)))) { logger.info('Upload cancelled.'); return; }
  }

  // Upload with progress
  logger.newline();
  const bar = new cliProgress.SingleBar({
    format: chalk.cyan('  Uploading ') + chalk.cyan('{bar}') + ' {percentage}% | {speed} | ETA: {eta_f} | {chunks}',
    barCompleteChar: '█', barIncompleteChar: '░', hideCursor: true, clearOnComplete: false, barsize: 30,
  }, cliProgress.Presets.shades_classic);

  const engine = createUploadEngine();
  engine.on('progress', (p) => { 
    const isProcessing = p.percentage === 99;
    bar.update(p.percentage, { 
      speed: isProcessing ? 'Processing...' : `${formatBytes(p.speed)}/s`, 
      eta_f: isProcessing ? '--' : formatDuration(p.eta), 
      chunks: `${p.currentChunk}/${p.totalChunks}` 
    }); 
  });
  engine.on('chunk_retry', ({ index, attempt, maxRetries }) => { logger.warn(`Retrying chunk ${index + 1} (${attempt}/${maxRetries})`); });

  bar.start(100, 0, { speed: '0 B/s', eta_f: 'calculating...', chunks: '0/0' });

  try {
    const result = await engine.upload({ filePath: resolved, projectId: projectConfig.projectId, platform, fileType, changelog, branch, commitHash, versionName, versionCode });
    bar.update(100, { speed: 'Done', eta_f: '0s', chunks: 'complete' });
    bar.stop();
    displayResult(result);
  } catch (e) { bar.stop(); throw e; }
}

function displayResult(result: UploadResult): void {
  logger.newline();
  logger.success('Build uploaded successfully! 🎉');
  const data: Record<string, string> = {
    'Version ID': result.versionId,
    'Version': `${result.versionName} (${result.versionCode})`,
    'APK Path': result.apkUrl
  };
  logger.box('Upload Complete', data);
  logger.newline();
}

/**
 * Doctor Command — Diagnose configuration and connectivity issues
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { configManager } from '../config';
import { authManager } from '../services/auth';
import { DoctorCheck } from '../types';
import { CONFIG_DIR, PROJECT_DIR, PROJECT_CONFIG_FILE } from '../constants';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isGitRepo, getCurrentBranch } from '../utils/git';

export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Check BuildShare CLI configuration and connectivity')
    .action(async () => {
      try {
        await configManager.initialize();

        logger.newline();
        logger.info(chalk.bold('🩺 BuildShare Doctor'));
        logger.divider();
        logger.newline();

        const checks: DoctorCheck[] = [];

        // 1. Config directory
        checks.push({
          name: 'Config Directory',
          status: fs.existsSync(CONFIG_DIR) ? 'pass' : 'warn',
          message: fs.existsSync(CONFIG_DIR) ? `Found at ${CONFIG_DIR}` : `Not found at ${CONFIG_DIR}`,
          suggestion: 'Run "buildshare login" to create it.',
        });

        // 2. Authentication
        const isAuthed = await authManager.isAuthenticated();
        const user = await authManager.getCurrentUser();
        checks.push({
          name: 'Authentication',
          status: isAuthed ? 'pass' : 'fail',
          message: isAuthed ? `Logged in as ${user?.email}` : 'Not authenticated',
          suggestion: 'Run "buildshare login" to authenticate.',
        });

        // 3. Project config
        const projectPath = path.join(process.cwd(), PROJECT_DIR, PROJECT_CONFIG_FILE);
        const hasProject = fs.existsSync(projectPath);
        checks.push({
          name: 'Project Config',
          status: hasProject ? 'pass' : 'warn',
          message: hasProject ? 'project.json found' : 'No project initialized in this directory',
          suggestion: 'Run "buildshare init" to set up a project.',
        });

        // 4. Validate project config
        if (hasProject) {
          try {
            const config = await configManager.readProjectConfig();
            checks.push({ name: 'Project Validation', status: 'pass', message: `Project: ${config.projectName}` });

            // Check Android path
            if (config.androidPath) {
              const androidExists = fs.existsSync(path.resolve(process.cwd(), config.androidPath));
              checks.push({
                name: 'Android Build Path',
                status: androidExists ? 'pass' : 'warn',
                message: androidExists ? config.androidPath : `File not found: ${config.androidPath}`,
                suggestion: 'Update the path in .buildshare/project.json',
              });
            }

            // Check iOS path
            if (config.iosPath) {
              const iosExists = fs.existsSync(path.resolve(process.cwd(), config.iosPath));
              checks.push({
                name: 'iOS Build Path',
                status: iosExists ? 'pass' : 'warn',
                message: iosExists ? config.iosPath : `File not found: ${config.iosPath}`,
                suggestion: 'Update the path in .buildshare/project.json',
              });
            }
          } catch (e) {
            checks.push({ name: 'Project Validation', status: 'fail', message: 'Invalid project.json', suggestion: 'Run "buildshare init" to reinitialize.' });
          }
        }

        // 5. Git
        checks.push({
          name: 'Git Repository',
          status: isGitRepo() ? 'pass' : 'warn',
          message: isGitRepo() ? `Branch: ${getCurrentBranch() || 'unknown'}` : 'Not a git repository',
          suggestion: 'Git integration is optional but recommended.',
        });

        // 6. Node.js version
        const nodeVersion = process.version;
        const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
        checks.push({
          name: 'Node.js Version',
          status: major >= 18 ? 'pass' : 'fail',
          message: nodeVersion,
          suggestion: 'BuildShare CLI requires Node.js 18 or later.',
        });

        // 7. Network check
        try {
          const config = configManager.getConfig();
          const axios = require('axios');
          await axios.head(config.apiUrl, { timeout: 5000 });
          checks.push({ name: 'API Connectivity', status: 'pass', message: `Connected to ${config.apiUrl}` });
        } catch {
          checks.push({ name: 'API Connectivity', status: 'warn', message: 'Cannot reach API server', suggestion: 'Check your internet connection and BUILDSHARE_API_URL.' });
        }

        // Display results
        for (const check of checks) {
          const icon = check.status === 'pass' ? chalk.green('✔') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✖');
          const label = check.status === 'pass' ? chalk.green(check.name) : check.status === 'warn' ? chalk.yellow(check.name) : chalk.red(check.name);
          console.log(`  ${icon}  ${label}: ${chalk.gray(check.message)}`);
          if (check.status !== 'pass' && check.suggestion) {
            console.log(`     ${chalk.gray('→')} ${chalk.dim(check.suggestion)}`);
          }
        }

        const passed = checks.filter(c => c.status === 'pass').length;
        const warnings = checks.filter(c => c.status === 'warn').length;
        const failed = checks.filter(c => c.status === 'fail').length;

        logger.newline();
        logger.divider();
        console.log(`  ${chalk.green(`${passed} passed`)}  ${chalk.yellow(`${warnings} warnings`)}  ${chalk.red(`${failed} failed`)}`);
        logger.newline();
      } catch (error) {
        handleError(error);
      }
    });
}

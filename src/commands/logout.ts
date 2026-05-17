/**
 * Logout Command
 * Removes stored authentication data
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { configManager } from '../config';
import { authManager } from '../services/auth';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function createLogoutCommand(): Command {
  const command = new Command('logout')
    .description('Log out from BuildShare and clear stored credentials')
    .option('-f, --force', 'Skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ buildshare logout           # Interactive logout
  $ buildshare logout --force   # Force logout without confirmation
    `
    )
    .action(async (options) => {
      try {
        await configManager.initialize();

        const isAuthed = await authManager.isAuthenticated();

        if (!isAuthed) {
          logger.info('You are not currently logged in.');
          return;
        }

        // Show current user
        const user = await authManager.getCurrentUser();
        if (user) {
          logger.info(`Currently logged in as ${chalk.bold(user.email)}`);
        }

        // Confirm logout
        if (!options.force) {
          const inquirer = require('inquirer');
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to log out?',
              default: true,
            },
          ]);

          if (!confirm) {
            logger.info('Logout cancelled.');
            return;
          }
        }

        const spinner = ora({
          text: 'Logging out...',
          color: 'cyan',
        }).start();

        await authManager.clearAuth();

        spinner.succeed(chalk.green('Successfully logged out!'));
        logger.newline();
        logger.info(`Run ${chalk.cyan('buildshare login')} to sign in again.`);
      } catch (error) {
        handleError(error);
      }
    });

  return command;
}

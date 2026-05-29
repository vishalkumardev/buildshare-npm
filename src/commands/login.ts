/**
 * Login Command
 * Authenticates the user and stores encrypted credentials
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { configManager } from '../config';
import { apiClient } from '../api/client';
import { authManager } from '../services/auth';
import { API_ENDPOINTS, BANNER } from '../constants';
import { AuthResponse } from '../types';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  promptAuthMethod,
  promptCredentials,
  promptApiToken,
} from '../prompts';

export function createLoginCommand(): Command {
  const command = new Command('login')
    .description('Authenticate with BuildShare')
    .option('-t, --token <token>', 'Authenticate with API token (for CI/CD)')
    .option('-e, --email <email>', 'Email for authentication')
    .option('-p, --password <password>', 'Password for authentication')
    .addHelpText(
      'after',
      `
Examples:
  $ buildshare login                    # Interactive login
  $ buildshare login --token <token>    # CI/CD token login
  $ buildshare login -e user@email.com  # Login with email (will prompt for password)
    `
    )
    .action(async (options) => {
      try {
        await configManager.initialize();
        apiClient.initialize();

        console.log(chalk.cyan.bold(BANNER));

        // Check if already logged in
        const isAuthed = await authManager.isAuthenticated();
        if (isAuthed) {
          const user = await authManager.getCurrentUser();
          logger.info(`Already logged in as ${chalk.bold(user?.email)}`);
          const inquirer = require('inquirer');
          const { relogin } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'relogin',
              message: 'Would you like to log in with a different account?',
              default: false,
            },
          ]);
          if (!relogin) return;
        }

        // Handle non-interactive token login
        if (options.token) {
          await handleTokenLogin(options.token);
          return;
        }

        // Handle non-interactive credential login
        if (options.email) {
          const password = options.password || (await promptPasswordOnly());
          await handleCredentialLogin(options.email, password);
          return;
        }

        // Interactive mode
        const method = await promptAuthMethod();

        if (method === 'token') {
          const token = await promptApiToken();
          await handleTokenLogin(token);
        } else {
          const { email, password } = await promptCredentials();
          await handleCredentialLogin(email, password);
        }
      } catch (error) {
        handleError(error);
      }
    });

  return command;
}

async function handleCredentialLogin(email: string, password: string): Promise<void> {
  const spinner = ora({
    text: 'Authenticating...',
    color: 'cyan',
  }).start();

  try {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      { email, password }
    );

    const authData = response.data;

    // Map backend login payload to the local credentials structure stored by CLI
    const tokens = {
      accessToken: authData.token,
      refreshToken: "",
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    };

    const user = {
      id: String(authData.userId),
      name: authData.name,
      email: authData.email,
      organization: 'Personal',
    };

    await authManager.storeAuth(tokens, user);

    spinner.succeed(chalk.green('Authentication successful!'));
    logger.newline();

    logger.box('Welcome to BuildShare!', {
      'User': user.name,
      'Email': user.email,
      'Organization': user.organization,
    });

    logger.info(`Run ${chalk.cyan('buildshare init')} to set up a project.`);
  } catch (error) {
    spinner.fail(chalk.red('Authentication failed'));
    throw error;
  }
}

async function handleTokenLogin(token: string): Promise<void> {
  const spinner = ora({
    text: 'Validating API token...',
    color: 'cyan',
  }).start();

  try {
    // Validate the token with the server
    const response = await apiClient.post<{
      accessToken: string;
      user: { userId: number; name: string; email: string };
    }>(
      API_ENDPOINTS.AUTH.VERIFY_API_KEY,
      { apiKey: token }
    );

    const authData = response.data;

    const tokens = {
      accessToken: authData.accessToken,
      refreshToken: "",
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    };

    const userProfile = {
      id: authData.user?.userId ? String(authData.user.userId) : "api-token-user",
      name: authData.user?.name || "API Token User",
      email: authData.user?.email || "api-token@buildshare.io",
      organization: "Personal",
    };

    await authManager.storeAuth(tokens, userProfile);

    spinner.succeed(chalk.green('API token stored successfully!'));
    logger.newline();
    
    logger.box('Welcome to BuildShare!', {
      'User': userProfile.name,
      'Email': userProfile.email,
      'Organization': userProfile.organization,
    });
    
    logger.info('You are now authenticated via API token.');
    logger.info(`Run ${chalk.cyan('buildshare init')} to set up a project.`);
  } catch (error) {
    spinner.fail(chalk.red('Token validation failed'));
    throw error;
  }
}

async function promptPasswordOnly(): Promise<string> {
  const inquirer = require('inquirer');
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '●',
    },
  ]);
  return password;
}

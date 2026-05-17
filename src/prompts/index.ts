/**
 * Interactive prompts for BuildShare CLI
 * Centralized prompt definitions using Inquirer.js
 */

import inquirer from 'inquirer';
import { Project, ReleaseType } from '../types';
import { RELEASE_TYPES } from '../constants';

// ─── Authentication Prompts ──────────────────────────────────────────────────

export async function promptAuthMethod(): Promise<'credentials' | 'token'> {
  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: 'How would you like to authenticate?',
      choices: [
        { name: '📧  Email & Password', value: 'credentials' },
        { name: '🔑  API Token', value: 'token' },
      ],
    },
  ]);
  return method;
}

export async function promptCredentials(): Promise<{ email: string; password: string }> {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: (input: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Please enter a valid email address';
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '●',
      validate: (input: string) => {
        return input.length >= 6 || 'Password must be at least 6 characters';
      },
    },
  ]);
}

export async function promptApiToken(): Promise<string> {
  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'API Token:',
      mask: '●',
      validate: (input: string) => {
        return input.length >= 10 || 'Token must be at least 10 characters';
      },
    },
  ]);
  return token;
}

// ─── Project Prompts ─────────────────────────────────────────────────────────

export async function promptProjectAction(projects: Project[]): Promise<'create' | string> {
  const choices = [
    { name: '✨  Create new project', value: 'create' },
    new inquirer.Separator('── Existing Projects ──'),
    ...projects.map((p) => ({
      name: `📦  ${p.name}`,
      value: p.appId,
    })),
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select a project:',
      choices,
      pageSize: 15,
    },
  ]);

  return action;
}

export async function promptProjectName(): Promise<string> {
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: (input: string) => {
        if (input.trim().length < 2) return 'Project name must be at least 2 characters';
        if (input.trim().length > 50) return 'Project name must be at most 50 characters';
        return true;
      },
    },
  ]);
  return name.trim();
}

export async function promptPackageName(): Promise<string> {
  const { packageName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'packageName',
      message: 'Package name (e.g. com.example.app):',
      validate: (input: string) => {
        if (input.trim().length < 3) return 'Package name must be at least 3 characters';
        if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+[0-9a-z_]$/i.test(input.trim())) {
          return 'Please enter a valid package name (e.g. com.example.app)';
        }
        return true;
      },
    },
  ]);
  return packageName.trim();
}

export async function promptBuildPaths(): Promise<{ androidPath: string; iosPath: string }> {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'androidPath',
      message: 'Android build file path (APK/AAB):',
      default: '',
      filter: (input: string) => input.trim(),
    },
    {
      type: 'input',
      name: 'iosPath',
      message: 'iOS build file path (IPA):',
      default: '',
      filter: (input: string) => input.trim(),
    },
  ]);
}

export async function promptAddToGitignore(): Promise<boolean> {
  const { addGitignore } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addGitignore',
      message: 'Add .buildshare to .gitignore?',
      default: true,
    },
  ]);
  return addGitignore;
}

// ─── Upload Prompts ──────────────────────────────────────────────────────────

export async function promptChangelog(): Promise<string> {
  const { changelog } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'changelog',
      message: 'Enter changelog / release notes:',
      validate: (input: string) => {
        return input.trim().length > 0 || 'Changelog is required';
      },
    },
  ]);
  return changelog.trim();
}

export async function promptChangelogInline(): Promise<string> {
  const { changelog } = await inquirer.prompt([
    {
      type: 'input',
      name: 'changelog',
      message: 'Changelog message:',
      validate: (input: string) => {
        return input.trim().length > 0 || 'Changelog is required';
      },
    },
  ]);
  return changelog.trim();
}

export async function promptReleaseType(): Promise<ReleaseType> {
  const { releaseType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'releaseType',
      message: 'Release type:',
      choices: RELEASE_TYPES.map((rt) => ({
        name: rt.name,
        value: rt.value,
      })),
    },
  ]);
  return releaseType as ReleaseType;
}

export async function promptOverwriteConfig(): Promise<boolean> {
  const { overwrite } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'overwrite',
      message: 'BuildShare project already exists. Overwrite?',
      default: false,
    },
  ]);
  return overwrite;
}

export async function promptConfirmUpload(
  fileName: string,
  fileSize: string,
  releaseType: string
): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Upload ${fileName} (${fileSize}) as ${releaseType}?`,
      default: true,
    },
  ]);
  return confirm;
}

export async function promptSelectBuildFile(files: string[]): Promise<string> {
  const { file } = await inquirer.prompt([
    {
      type: 'list',
      name: 'file',
      message: 'Multiple build files found. Select one:',
      choices: files.map((f) => ({
        name: require('path').basename(f),
        value: f,
      })),
    },
  ]);
  return file;
}

export async function promptDefaultBranch(): Promise<string> {
  const { branch } = await inquirer.prompt([
    {
      type: 'input',
      name: 'branch',
      message: 'Default branch:',
      default: 'main',
    },
  ]);
  return branch.trim();
}

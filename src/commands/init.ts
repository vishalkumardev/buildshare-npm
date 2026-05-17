/**
 * Init Command
 * Initialize a BuildShare project in the current directory
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { configManager } from '../config';
import { apiClient } from '../api/client';
import { authManager } from '../services/auth';
import { projectService } from '../services/project';
import { ProjectConfig } from '../types';
import { PROJECT_DIR } from '../constants';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isGitRepo, addToGitignore, getCurrentBranch } from '../utils/git';
import {
  promptProjectAction,
  promptProjectName,
  promptBuildPaths,
  promptAddToGitignore,
  promptOverwriteConfig,
  promptDefaultBranch,
} from '../prompts';

export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize a BuildShare project in the current directory')
    .option('--project-id <id>', 'Use an existing project by ID')
    .option('--project-name <name>', 'Create a new project with this name')
    .option('--android-path <path>', 'Path to Android APK/AAB')
    .option('--ios-path <path>', 'Path to iOS IPA')
    .option('-y, --yes', 'Accept defaults (non-interactive)')
    .addHelpText(
      'after',
      `
Examples:
  $ buildshare init                                    # Interactive setup
  $ buildshare init --project-name "My App"            # Create new project
  $ buildshare init --project-id abc123                # Use existing project
  $ buildshare init --android-path ./app/build/app.apk # Set Android path
    `
    )
    .action(async (options) => {
      try {
        await configManager.initialize();
        apiClient.initialize();
        await authManager.requireAuth();

        logger.newline();
        logger.info(`Initializing BuildShare project in ${chalk.cyan(process.cwd())}`);
        logger.divider();

        // Check if already initialized
        if (configManager.isProjectInitialized() && !options.yes) {
          const overwrite = await promptOverwriteConfig();
          if (!overwrite) {
            logger.info('Initialization cancelled.');
            return;
          }
        }

        let projectId: string;
        let projectName: string;

        // ─── Step 1: Select or create project ──────────────────────────

        if (options.projectId) {
          // Non-interactive: use provided project ID
          const spinner = ora('Fetching project...').start();
          const project = await projectService.getProject(options.projectId);
          spinner.succeed(`Project: ${chalk.bold(project.name)}`);
          projectId = project.id;
          projectName = project.name;
        } else if (options.projectName) {
          // Non-interactive: create new project
          const spinner = ora('Creating project...').start();
          const project = await projectService.createProject(options.projectName);
          spinner.succeed(`Project created: ${chalk.bold(project.name)}`);
          projectId = project.id;
          projectName = project.name;
        } else {
          // Interactive: fetch and select
          const spinner = ora('Fetching your projects...').start();

          let projects: import('../types').Project[] = [];
          try {
            projects = await projectService.listProjects();
            spinner.succeed(`Found ${projects.length} project(s)`);
          } catch {
            spinner.warn('Could not fetch projects. You can create a new one.');
            projects = [];
          }

          logger.newline();
          const action = await promptProjectAction(projects);

          if (action === 'create') {
            const name = await promptProjectName();
            const createSpinner = ora('Creating project...').start();
            const project = await projectService.createProject(name);
            createSpinner.succeed(`Project created: ${chalk.bold(project.name)}`);
            projectId = project.id;
            projectName = project.name;
          } else {
            const selected = projects.find((p) => p.id === action);
            if (!selected) {
              throw new Error('Project not found');
            }
            projectId = selected.id;
            projectName = selected.name;
            logger.success(`Selected project: ${chalk.bold(projectName)}`);
          }
        }

        // ─── Step 2: Configure build paths ─────────────────────────────

        logger.newline();
        logger.info('Configure build file paths:');

        let androidPath = options.androidPath || '';
        let iosPath = options.iosPath || '';

        if (!options.yes && !options.androidPath && !options.iosPath) {
          const paths = await promptBuildPaths();
          androidPath = paths.androidPath;
          iosPath = paths.iosPath;
        }

        // Validate paths if provided
        if (androidPath) {
          const resolved = path.resolve(process.cwd(), androidPath);
          if (!fs.existsSync(resolved)) {
            logger.warn(`Android path does not exist yet: ${chalk.yellow(androidPath)}`);
            logger.info('You can update it later in .buildshare/project.json');
          }
        }

        if (iosPath) {
          const resolved = path.resolve(process.cwd(), iosPath);
          if (!fs.existsSync(resolved)) {
            logger.warn(`iOS path does not exist yet: ${chalk.yellow(iosPath)}`);
            logger.info('You can update it later in .buildshare/project.json');
          }
        }

        // ─── Step 3: Default branch ────────────────────────────────────

        let defaultBranch = 'main';
        if (isGitRepo()) {
          const currentBranch = getCurrentBranch();
          if (currentBranch) {
            defaultBranch = currentBranch;
          }
        }

        if (!options.yes) {
          defaultBranch = await promptDefaultBranch();
        }

        // ─── Step 4: Write config ──────────────────────────────────────

        const config: ProjectConfig = {
          projectId,
          projectName,
          androidPath,
          iosPath,
          defaultBranch,
        };

        const writeSpinner = ora('Writing project configuration...').start();
        await configManager.writeProjectConfig(config);
        writeSpinner.succeed('Project configuration saved');

        // ─── Step 5: Git integration ───────────────────────────────────

        if (isGitRepo() && !options.yes) {
          const shouldAddGitignore = await promptAddToGitignore();
          if (shouldAddGitignore) {
            const added = addToGitignore(PROJECT_DIR);
            if (added) {
              logger.success('.buildshare added to .gitignore');
            } else {
              logger.info('.buildshare already in .gitignore');
            }
          }
        } else if (isGitRepo() && options.yes) {
          addToGitignore(PROJECT_DIR);
        }

        // ─── Summary ──────────────────────────────────────────────────

        logger.newline();
        logger.divider();
        logger.box('Project Initialized', {
          'Project': projectName,
          'ID': projectId,
          'Android': androidPath || '(not set)',
          'iOS': iosPath || '(not set)',
          'Branch': defaultBranch,
          'Config': `./${PROJECT_DIR}/project.json`,
        });

        logger.info('Next steps:');
        logger.step(1, 3, `Upload Android: ${chalk.cyan('buildshare upload android')}`);
        logger.step(2, 3, `Upload iOS:     ${chalk.cyan('buildshare upload ios')}`);
        logger.step(3, 3, `Check config:   ${chalk.cyan('buildshare doctor')}`);
        logger.newline();
      } catch (error) {
        handleError(error);
      }
    });

  return command;
}

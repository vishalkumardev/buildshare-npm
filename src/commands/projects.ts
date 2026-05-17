import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { apiClient } from '../api/client';
import { configManager } from '../config';
import { authManager } from '../services/auth';
import { API_ENDPOINTS } from '../constants';
import { Project, AppListResponse } from '../types';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function createProjectsCommand(): Command {
  const command = new Command('projects')
    .alias('project')
    .description('Manage BuildShare projects');

  command
    .command('list')
    .description('List all projects you have access to')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-s, --size <number>', 'Page size', '15')
    .action(async (options) => {
        let spinner;
      try {
        await configManager.initialize();
        apiClient.initialize();
        
        const isAuthed = await authManager.isAuthenticated();
        if (!isAuthed) {
          logger.error('You are not authenticated. Run "buildshare login" first.');
          process.exit(1);
        }

        spinner = ora({
          text: 'Fetching projects...',
          color: 'cyan'
        }).start();

        const response = await apiClient.post<AppListResponse>(
          API_ENDPOINTS.PROJECTS.LIST,
          {
            page: parseInt(options.page, 10),
            pageSize: parseInt(options.size, 10)
          }
        );

        spinner.stop();

        const projects = response.data.records;
        
        if (!projects || projects.length === 0) {
          logger.info('No projects found.');
          return;
        }

        logger.newline();
        logger.info(chalk.bold('Your Projects:'));
        logger.newline();

        projects.forEach((project: Project, index: number) => {
          console.log(`${chalk.cyan(index + 1 + '.')} ${chalk.bold(project.name)}`);
          console.log(`   ID: ${chalk.gray(project.appId)}`);
          console.log(`   Package: ${chalk.gray(project.packageName)}`);
          if (project.organization) {
            console.log(`   Organization: ${chalk.gray(project.organization.name)}`);
          }
          console.log();
        });
        
        const { currentPage, totalPages } = response.data;
        if (totalPages > 1) {
          console.log(chalk.gray(`Page ${currentPage} of ${totalPages}`));
        }

      } catch (error) {
        if (spinner?.isSpinning) {
          spinner.stop();
        }
        handleError(error);
      }
    });

  command
    .command('create <name> <packageName>')
    .description('Create a new project')
    .action(async (name, packageName) => {
      let spinner;
      try {
        await configManager.initialize();
        apiClient.initialize();

        const isAuthed = await authManager.isAuthenticated();
        if (!isAuthed) {
          logger.error('You are not authenticated. Run "buildshare login" first.');
          process.exit(1);
        }

        spinner = ora({
          text: 'Creating project...',
          color: 'cyan'
        }).start();

        const { projectService } = require('../services/project');
        const project = await projectService.createProject(name, packageName);

        spinner.succeed(`Project created: ${chalk.bold(project.name)}`);
        logger.newline();
        console.log(`   ID: ${chalk.gray(project.appId)}`);
        console.log(`   Package: ${chalk.gray(project.packageName)}`);

      } catch (error) {
        if (spinner?.isSpinning) {
          spinner.stop();
        }
        handleError(error);
      }
    });

  return command;
}

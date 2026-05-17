#!/usr/bin/env node

/**
 * BuildShare CLI — Production-grade cross-platform build distribution tool
 *
 * Distribute Android APK/AAB and iOS IPA builds effortlessly.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION, BANNER } from './constants';
import {
  createLoginCommand,
  createLogoutCommand,
  createInitCommand,
  createUploadCommand,
  createDoctorCommand,
  createProjectsCommand,
} from './commands';
import { handleError } from './utils/errors';

function main(): void {
  const program = new Command();

  program
    .name(APP_NAME)
    .version(APP_VERSION, '-v, --version', 'Display CLI version')
    .description(APP_DESCRIPTION)
    .option('--debug', 'Enable debug mode')
    .option('--verbose', 'Enable verbose logging')
    .addHelpText('before', chalk.cyan(BANNER))
    .addHelpText(
      'after',
      `
${chalk.bold('Quick Start:')}
  $ buildshare login             ${chalk.gray('# Authenticate with BuildShare')}
  $ buildshare init              ${chalk.gray('# Initialize a project')}
  $ buildshare upload android    ${chalk.gray('# Upload Android build')}
  $ buildshare upload ios        ${chalk.gray('# Upload iOS build')}
  $ buildshare doctor            ${chalk.gray('# Check configuration')}

${chalk.bold('Documentation:')}
  ${chalk.underline('https://docs.buildshare.io/cli')}

${chalk.bold('Support:')}
  ${chalk.underline('https://github.com/buildshare/cli/issues')}
`
    );

  // Set global options before command execution
  program.hook('preAction', (thisCommand) => {
    if (thisCommand.opts().debug) {
      process.env.BUILDSHARE_DEBUG = 'true';
    }
    if (thisCommand.opts().verbose) {
      process.env.BUILDSHARE_VERBOSE = 'true';
    }
  });

  // Register commands
  program.addCommand(createLoginCommand());
  program.addCommand(createLogoutCommand());
  program.addCommand(createInitCommand());
  program.addCommand(createUploadCommand());
  program.addCommand(createDoctorCommand());
  program.addCommand(createProjectsCommand());

  // Handle unknown commands
  program.on('command:*', (operands) => {
    console.error(
      chalk.red(`\nError: Unknown command "${operands[0]}".`)
    );
    console.error(
      `Run ${chalk.cyan('buildshare --help')} to see available commands.\n`
    );
    process.exit(1);
  });

  // Parse and execute
  program.parseAsync(process.argv).catch(handleError);
}

// Run
main();

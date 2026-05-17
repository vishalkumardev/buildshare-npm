/**
 * Structured logger with colored output and log levels
 */

import chalk from 'chalk';
import { LogLevel } from '../types';

class Logger {
  private debugMode = false;
  private verboseMode = false;

  setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setVerbose(enabled: boolean): void {
    this.verboseMode = enabled;
  }

  private timestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const ts = this.verboseMode ? chalk.gray(`[${this.timestamp()}] `) : '';
    let prefix: string;

    switch (level) {
      case LogLevel.DEBUG:
        prefix = chalk.magenta('⚙ DEBUG');
        break;
      case LogLevel.INFO:
        prefix = chalk.blue('ℹ INFO');
        break;
      case LogLevel.WARN:
        prefix = chalk.yellow('⚠ WARN');
        break;
      case LogLevel.ERROR:
        prefix = chalk.red('✖ ERROR');
        break;
      case LogLevel.SUCCESS:
        prefix = chalk.green('✔ SUCCESS');
        break;
    }

    let output = `${ts}${prefix}  ${message}`;

    if (meta && this.verboseMode) {
      output += '\n' + chalk.gray(JSON.stringify(meta, null, 2));
    }

    return output;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.debugMode) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, meta));
  }

  success(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message, meta));
  }

  // ─── Formatted Output ───────────────────────────────────────────────

  banner(text: string): void {
    console.log(chalk.cyan.bold(text));
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  newline(): void {
    console.log();
  }

  table(data: Record<string, string>): void {
    const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));
    this.newline();
    for (const [key, value] of Object.entries(data)) {
      const paddedKey = key.padEnd(maxKeyLen);
      console.log(`  ${chalk.cyan(paddedKey)}  ${chalk.white(value)}`);
    }
    this.newline();
  }

  box(title: string, content: Record<string, string>): void {
    const entries = Object.entries(content);
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    const maxValLen = Math.max(...entries.map(([, v]) => v.length));
    const innerWidth = Math.max(title.length + 4, maxKeyLen + maxValLen + 7);

    this.newline();
    console.log(chalk.cyan(`  ┌${'─'.repeat(innerWidth)}┐`));
    console.log(chalk.cyan(`  │${' '.repeat(Math.floor((innerWidth - title.length) / 2))}${chalk.bold.white(title)}${' '.repeat(Math.ceil((innerWidth - title.length) / 2))}│`));
    console.log(chalk.cyan(`  ├${'─'.repeat(innerWidth)}┤`));

    for (const [key, value] of entries) {
      const paddedKey = key.padEnd(maxKeyLen);
      const paddedVal = value.padEnd(maxValLen);
      const padding = innerWidth - maxKeyLen - maxValLen - 5;
      console.log(chalk.cyan(`  │ `) + chalk.gray(paddedKey) + chalk.cyan(' : ') + chalk.green(paddedVal) + ' '.repeat(Math.max(0, padding)) + chalk.cyan(' │'));
    }

    console.log(chalk.cyan(`  └${'─'.repeat(innerWidth)}┘`));
    this.newline();
  }

  step(stepNum: number, total: number, message: string): void {
    console.log(chalk.cyan(`  [${stepNum}/${total}]`) + ` ${message}`);
  }
}

// Singleton export
export const logger = new Logger();

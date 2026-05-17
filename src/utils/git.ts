/**
 * Git utilities for branch detection and commit hash tagging
 */

import { execSync } from 'child_process';
import { logger } from './logger';

/**
 * Check if the current directory is a git repository
 */
export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git branch name
 */
export function getCurrentBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' })
      .toString()
      .trim();
    return branch || null;
  } catch {
    logger.debug('Failed to detect git branch');
    return null;
  }
}

/**
 * Get the current git commit hash (short)
 */
export function getCommitHash(): string | null {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: 'pipe' })
      .toString()
      .trim();
    return hash || null;
  } catch {
    logger.debug('Failed to detect git commit hash');
    return null;
  }
}

/**
 * Get the latest git commit message
 */
export function getLatestCommitMessage(): string | null {
  try {
    const message = execSync('git log -1 --pretty=%B', { stdio: 'pipe' })
      .toString()
      .trim();
    return message || null;
  } catch {
    logger.debug('Failed to get latest commit message');
    return null;
  }
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(): boolean {
  try {
    const status = execSync('git status --porcelain', { stdio: 'pipe' })
      .toString()
      .trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Add a path to .gitignore if it doesn't already exist
 */
export function addToGitignore(entry: string): boolean {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    const gitignorePath = path.join(process.cwd(), '.gitignore');

    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }

    if (!content.includes(entry)) {
      const newContent = content.endsWith('\n')
        ? `${content}${entry}\n`
        : `${content}\n${entry}\n`;
      fs.writeFileSync(gitignorePath, newContent, 'utf-8');
      return true;
    }

    return false;
  } catch {
    logger.debug('Failed to update .gitignore');
    return false;
  }
}

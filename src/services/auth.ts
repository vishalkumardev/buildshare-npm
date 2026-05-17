/**
 * Authentication Service
 * Handles login, logout, token storage, and token validation
 */

import fs from 'fs-extra';
import jwt from 'jsonwebtoken';
import { AUTH_FILE, CONFIG_DIR } from '../constants';
import { AuthTokens, StoredAuth, UserProfile, AuthResponse } from '../types';
import { encrypt, decrypt } from '../utils/crypto';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

class AuthManager {
  /**
   * Store authentication data securely
   */
  async storeAuth(tokens: AuthTokens, user: UserProfile): Promise<void> {
    const authData: StoredAuth = {
      tokens,
      user,
      encryptedAt: Date.now(),
    };

    await fs.ensureDir(CONFIG_DIR);

    const encryptedData = encrypt(JSON.stringify(authData));
    await fs.writeFile(AUTH_FILE, encryptedData, 'utf-8');

    // Set restrictive file permissions (owner-only read/write)
    try {
      await fs.chmod(AUTH_FILE, 0o600);
    } catch {
      // Windows doesn't support chmod the same way
      logger.debug('Could not set file permissions (Windows)');
    }

    logger.debug('Auth data stored securely');
  }

  /**
   * Retrieve stored authentication data
   */
  async getStoredAuth(): Promise<StoredAuth | null> {
    if (!await fs.pathExists(AUTH_FILE)) {
      return null;
    }

    try {
      const encryptedData = await fs.readFile(AUTH_FILE, 'utf-8');
      const decrypted = decrypt(encryptedData);
      const authData: StoredAuth = JSON.parse(decrypted);

      return authData;
    } catch {
      logger.debug('Failed to decrypt auth data — may have been created on a different machine');
      return null;
    }
  }

  /**
   * Update stored tokens (after refresh)
   */
  async updateTokens(tokens: AuthTokens): Promise<void> {
    const stored = await this.getStoredAuth();
    if (!stored) {
      throw new AuthenticationError('No stored auth to update.');
    }

    await this.storeAuth(tokens, stored.user);
    logger.debug('Auth tokens updated');
  }

  /**
   * Check if the user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const stored = await this.getStoredAuth();

    if (!stored) {
      return false;
    }

    // Check if token is expired
    if (this.isTokenExpired(stored.tokens)) {
      logger.debug('Access token expired');
      return false;
    }

    return true;
  }

  /**
   * Validate that the user is authenticated, throw if not
   */
  async requireAuth(): Promise<StoredAuth> {
    const stored = await this.getStoredAuth();

    if (!stored) {
      throw new AuthenticationError(
        'You are not logged in.',
        'Run "buildshare login" to authenticate.'
      );
    }

    // Check if access token is expired but refresh token is still valid
    if (this.isTokenExpired(stored.tokens)) {
      // Check if refresh token is also expired
      try {
        const decoded = jwt.decode(stored.tokens.refreshToken) as { exp?: number } | null;
        if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
          throw new AuthenticationError(
            'Your session has expired.',
            'Run "buildshare login" to authenticate again.'
          );
        }
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        // If we can't decode the refresh token, let the API handle it
      }
    }

    return stored;
  }

  /**
   * Remove stored authentication data (logout)
   */
  async clearAuth(): Promise<void> {
    if (await fs.pathExists(AUTH_FILE)) {
      await fs.remove(AUTH_FILE);
    }

    logger.debug('Auth data cleared');
  }

  /**
   * Get the current user profile
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    const stored = await this.getStoredAuth();
    return stored?.user || null;
  }

  /**
   * Check if the access token is expired
   */
  private isTokenExpired(tokens: AuthTokens): boolean {
    // Check the expiresAt timestamp
    if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
      return true;
    }

    // Also try to decode the JWT and check exp claim
    try {
      const decoded = jwt.decode(tokens.accessToken) as { exp?: number } | null;
      if (decoded?.exp) {
        // Add 30 second buffer to account for clock drift
        return decoded.exp * 1000 < Date.now() - 30000;
      }
    } catch {
      // If we can't decode, rely on expiresAt
    }

    return false;
  }

  /**
   * Login with email and password
   */
  async loginWithCredentials(_email: string, _password: string): Promise<AuthResponse> {
    // This will be called from the command, which will use apiClient
    // This method exists for the interface but the actual API call happens in the command
    // to avoid circular dependencies
    throw new Error('Use apiClient directly for login');
  }

  /**
   * Login with API token (CI/CD)
   */
  async loginWithToken(token: string): Promise<void> {
    // Store a minimal auth with the API token
    const tokens: AuthTokens = {
      accessToken: token,
      refreshToken: '',
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    };

    const user: UserProfile = {
      id: 'api-token-user',
      email: 'api-token@buildshare.io',
      name: 'API Token',
    };

    await this.storeAuth(tokens, user);
  }
}

// Singleton export
export const authManager = new AuthManager();

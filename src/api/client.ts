/**
 * API Client for BuildShare backend
 * Handles HTTP requests, authentication headers, and token refresh
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { configManager } from '../config';
import { authManager } from '../services/auth';
import { API_TIMEOUT, API_ENDPOINTS } from '../constants';
import { NetworkError, AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ApiRequestConfig, ApiResponse } from '../types';

class ApiClient {
  private client: AxiosInstance | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  /**
   * Initialize the Axios client with base URL and interceptors
   */
  initialize(): void {
    const config = configManager.getConfig();

    this.client = axios.create({
      baseURL: `${config.apiUrl}/${config.apiVersion}`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BuildShare-CLI/1.0.0',
        'X-Client-Platform': process.platform,
      },
    });

    // Request interceptor — attach auth token
    this.client.interceptors.request.use(
      async (reqConfig) => {
        const token = await this.getAuthToken();
        if (token) {
          reqConfig.headers.Authorization = `Bearer ${token}`;
        }

        logger.debug(`→ ${reqConfig.method?.toUpperCase()} ${reqConfig.url}`, {
          headers: reqConfig.headers as Record<string, unknown>,
        });

        return reqConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor — handle token refresh
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`← ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 — attempt token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAuthToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client!.request(originalRequest);
          } catch {
            throw new AuthenticationError('Session expired. Please log in again.');
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const auth = await authManager.getStoredAuth();
      if (auth) {
        return auth.tokens.accessToken;
      }

      // Check for CI token
      const config = configManager.getConfig();
      if (config.apiToken) {
        return config.apiToken;
      }
    } catch {
      logger.debug('No auth token available');
    }
    return null;
  }

  /**
   * Refresh the authentication token
   */
  private async refreshAuthToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const auth = await authManager.getStoredAuth();
        if (!auth) {
          throw new AuthenticationError('No stored credentials found.');
        }

        const response = await axios.post(
          `${configManager.getConfig().apiUrl}/${configManager.getConfig().apiVersion}${API_ENDPOINTS.AUTH.REFRESH}`,
          { refreshToken: auth.tokens.refreshToken }
        );

        const newTokens = response.data.data.tokens;
        await authManager.updateTokens(newTokens);

        return newTokens.accessToken;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Normalize Axios errors into BuildShare errors
   */
  private normalizeError(error: AxiosError): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown> | undefined;
      const message = (data?.message as string) || error.message;

      if (status === 401 || status === 403) {
        return new AuthenticationError(message);
      }

      return new NetworkError(
        `API Error (${status}): ${message}`,
        status,
        data
      );
    }

    if (error.code === 'ECONNABORTED') {
      return new NetworkError('Request timed out. Please try again.');
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new NetworkError(
        'Unable to connect to BuildShare servers. Check your internet connection.'
      );
    }

    return new NetworkError(error.message);
  }

  /**
   * Get the Axios instance
   */
  private getClient(): AxiosInstance {
    if (!this.client) {
      throw new Error('API client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  // ─── Public Request Methods ─────────────────────────────────────────

  async request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    const client = this.getClient();

    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.path,
      data: config.data,
      headers: config.headers,
      timeout: config.timeout,
      onUploadProgress: config.onUploadProgress
        ? (event) => {
            config.onUploadProgress!({
              loaded: event.loaded,
              total: event.total || 0,
            });
          }
        : undefined,
    };

    const response = await client.request<ApiResponse<T>>(axiosConfig);
    return response.data;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', path });
  }

  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', path, data });
  }

  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', path, data });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', path });
  }

  /**
   * Upload a chunk with multipart form data
   */
  async uploadChunk(
    path: string,
    formData: FormData | Buffer,
    headers: Record<string, string>,
    onProgress?: (loaded: number, total: number) => void,
    timeout?: number
  ): Promise<ApiResponse<unknown>> {
    const client = this.getClient();

    const response = await client.post(path, formData, {
      headers: {
        ...headers,
      },
      timeout: timeout || configManager.getConfig().uploadTimeout,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(event.loaded, event.total);
        }
      },
    });

    return response.data;
  }
}

// Singleton export
export const apiClient = new ApiClient();

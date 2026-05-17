/**
 * Project Service
 * Handles project CRUD operations via the API
 */

import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Project, AppListResponse } from '../types';
import { logger } from '../utils/logger';

class ProjectService {
  /**
   * Fetch all projects for the authenticated user
   */
  async listProjects(page: number = 1, pageSize: number = 100): Promise<Project[]> {
    const response = await apiClient.post<AppListResponse>(
      API_ENDPOINTS.PROJECTS.LIST,
      { page, pageSize }
    );

    logger.debug('Projects fetched', { count: response.data.records.length });
    return response.data.records;
  }

  /**
   * Create a new project
   */
  async createProject(name: string, packageName: string): Promise<Project> {
    const response = await apiClient.post<Project>(
      API_ENDPOINTS.PROJECTS.CREATE,
      { name, packageName }
    );

    logger.debug('Project created', { id: response.data.appId, name: response.data.name });
    return response.data;
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string): Promise<Project> {
    const response = await apiClient.get<{ project: Project }>(
      API_ENDPOINTS.PROJECTS.GET(id)
    );

    return response.data.project;
  }
}

// Singleton export
export const projectService = new ProjectService();

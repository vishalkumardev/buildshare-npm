/**
 * Project Service
 * Handles project CRUD operations via the API
 */

import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Project, ProjectListResponse, ProjectCreateResponse } from '../types';
import { logger } from '../utils/logger';

class ProjectService {
  /**
   * Fetch all projects for the authenticated user
   */
  async listProjects(): Promise<Project[]> {
    const response = await apiClient.get<ProjectListResponse['data']>(
      API_ENDPOINTS.PROJECTS.LIST
    );

    logger.debug('Projects fetched', { count: response.data.projects.length });
    return response.data.projects;
  }

  /**
   * Create a new project
   */
  async createProject(name: string): Promise<Project> {
    const response = await apiClient.post<ProjectCreateResponse['data']>(
      API_ENDPOINTS.PROJECTS.CREATE,
      { name }
    );

    logger.debug('Project created', { id: response.data.project.id, name: response.data.project.name });
    return response.data.project;
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

import axios from 'axios';

// Base backend URL: defaults to http://localhost:5000 as requested
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const projectService = {
  /**
   * Fetch all registered projects
   * @returns {Promise<{success: boolean, count: number, projects: Array}>}
   */
  async getAll() {
    const response = await apiClient.get('/projects');
    return response.data;
  },

  /**
   * Fetch a single project by ID
   * @param {number|string} id
   * @returns {Promise<{success: boolean, project: Object}>}
   */
  async getById(id) {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  /**
   * Register a new project
   * @param {{ website_name: string, website_url: string }} data
   * @returns {Promise<{success: boolean, message: string, projectId: number, project: Object}>}
   */
  async create(data) {
    const response = await apiClient.post('/projects', data);
    return response.data;
  },

  /**
   * Delete a project by ID
   * @param {number|string} id
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(id) {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },

  /**
   * Backend health check
   * @returns {Promise<{status: string, application: string}>}
   */
  async checkHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

export default apiClient;

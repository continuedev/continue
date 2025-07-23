import { jest } from '@jest/globals';

export const services = {
  auth: {
    login: jest.fn(() => Promise.resolve({})),
    logout: jest.fn(() => Promise.resolve({})),
    switchOrganization: jest.fn(() => Promise.resolve({})),
    getAvailableOrganizations: jest.fn(() => Promise.resolve([])),
  },
};

export const reloadService = jest.fn(() => Promise.resolve(undefined));

export const SERVICE_NAMES = {
  AUTH: 'auth',
  API_CLIENT: 'apiClient',
  CONFIG: 'config',
  MODEL: 'model',
  MCP: 'mcp',
};
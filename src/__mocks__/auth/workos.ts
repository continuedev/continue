import { jest } from '@jest/globals';

export const isAuthenticated = jest.fn(() => false);
export const isAuthenticatedConfig = jest.fn(() => false);
export const loadAuthConfig = jest.fn(() => Promise.resolve(null));
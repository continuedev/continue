import React from 'react';
import { jest } from "@jest/globals";
import { ServiceContainer } from '../../services/ServiceContainer.js';

// Create a mock service container
const mockServiceContainer = {
  getSync: jest.fn((serviceName: string) => ({
    state: "ready",
    value: {},
    error: null,
  })),
  isReady: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
  load: jest.fn(() => Promise.resolve()),
  reload: jest.fn(() => Promise.resolve()),
  emit: jest.fn(),
  setMaxListeners: jest.fn(),
} as unknown as ServiceContainer;

export const ServiceContainerProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

export const useServiceContainer = jest.fn(() => mockServiceContainer);
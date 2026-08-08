import React from "react";
import { vi } from "vitest";
import { ServiceContainer } from "../../services/ServiceContainer.js";

// Create a mock service container
const mockServiceContainer = {
  getSync: vi.fn((serviceName: string) => ({
    state: "ready",
    value: {},
    error: null,
  })),
  isReady: vi.fn(() => true),
  on: vi.fn(),
  off: vi.fn(),
  load: vi.fn(() => Promise.resolve()),
  reload: vi.fn(() => Promise.resolve()),
  emit: vi.fn(),
  setMaxListeners: vi.fn(),
} as unknown as ServiceContainer;

export const ServiceContainerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return React.createElement(React.Fragment, null, children);
};

export const useServiceContainer = vi.fn(() => mockServiceContainer);

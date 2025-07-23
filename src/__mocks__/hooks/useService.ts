import { jest } from "@jest/globals";

export const useService = jest.fn(() => ({
  value: null,
  state: "idle",
  error: null,
  reload: jest.fn(() => Promise.resolve()),
}));

export const useServices = jest.fn(() => ({
  services: {},
  loading: false,
  error: null,
  allReady: true,
}));
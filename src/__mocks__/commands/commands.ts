import { jest } from '@jest/globals';

export const getAllSlashCommands = jest.fn(() => [
  { name: "help", description: "Show help", category: "system" },
  { name: "login", description: "Login to Continue", category: "system" },
]);
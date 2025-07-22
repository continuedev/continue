import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { handleSlashCommands } from './slashCommands.js';

// Mock the services
const mockAuthService = {
  login: jest.fn(),
  logout: jest.fn(),
  switchOrganization: jest.fn(),
  getAvailableOrganizations: jest.fn(),
};

const mockServices = {
  auth: mockAuthService,
};

const mockReloadService = jest.fn();
const mockServiceNames = {
  AUTH: 'auth',
  API_CLIENT: 'apiClient',
  CONFIG: 'config',
  MODEL: 'model',
  MCP: 'mcp',
};

// Mock the auth functions
const mockIsAuthenticated = jest.fn();
const mockIsAuthenticatedConfig = jest.fn();
const mockLoadAuthConfig = jest.fn();

// Mock command functions
const mockGetAllSlashCommands = jest.fn();

// Setup mocks
jest.mock('./services/index.js', () => ({
  services: mockServices,
  reloadService: mockReloadService,
  SERVICE_NAMES: mockServiceNames,
}));

jest.mock('./auth/workos.js', () => ({
  isAuthenticated: mockIsAuthenticated,
  isAuthenticatedConfig: mockIsAuthenticatedConfig,
  loadAuthConfig: mockLoadAuthConfig,
}));

jest.mock('./commands/commands.js', () => ({
  getAllSlashCommands: mockGetAllSlashCommands,
}));

// Mock console to avoid output during tests
const originalConsole = console;
const mockConsole = {
  info: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

describe('handleSlashCommands', () => {
  const mockAssistant = {
    name: 'test-assistant',
    prompts: [
      { name: 'test', prompt: 'Test prompt: ' }
    ]
  };

  beforeEach(() => {
    Object.assign(console, mockConsole);
    jest.clearAllMocks();
    
    mockGetAllSlashCommands.mockReturnValue([
      { name: 'help', description: 'Show help' },
      { name: 'login', description: 'Login to Continue' }
    ]);
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  describe('Automatic Service Cascade Reloading', () => {
    test('login command should trigger automatic cascade reload via auth service', async () => {
      const newAuthState = {
        authConfig: { userEmail: 'test@example.com' },
        isAuthenticated: true,
      };
      
      mockAuthService.login.mockResolvedValue(newAuthState);
      mockIsAuthenticatedConfig.mockReturnValue(true);
      mockReloadService.mockResolvedValue(undefined);

      const result = await handleSlashCommands('/login', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Login successful! All services updated automatically.');
      
      // Verify auth service login was called
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      
      // Verify automatic cascade reload was triggered - only auth service reload needed
      expect(mockReloadService).toHaveBeenCalledTimes(1);
      expect(mockReloadService).toHaveBeenCalledWith(mockServiceNames.AUTH);
      
      // Verify manual service reloads are NOT called
      expect(mockReloadService).not.toHaveBeenCalledWith(mockServiceNames.API_CLIENT);
      expect(mockReloadService).not.toHaveBeenCalledWith(mockServiceNames.CONFIG);
    });

    test('org switch command should trigger automatic cascade reload via auth service', async () => {
      mockAuthService.switchOrganization.mockResolvedValue({ organizationId: 'new-org' });
      mockReloadService.mockResolvedValue(undefined);

      const result = await handleSlashCommands('/org test-org', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Switched to organization: test-org. All services updated automatically.');
      
      // Verify organization switch was called
      expect(mockAuthService.switchOrganization).toHaveBeenCalledWith('test-org');
      
      // Verify automatic cascade reload was triggered - only auth service reload needed
      expect(mockReloadService).toHaveBeenCalledTimes(1);
      expect(mockReloadService).toHaveBeenCalledWith(mockServiceNames.AUTH);
      
      // Verify manual service reloads are NOT called
      expect(mockReloadService).not.toHaveBeenCalledWith(mockServiceNames.CONFIG);
      expect(mockReloadService).not.toHaveBeenCalledWith(mockServiceNames.MODEL);
      expect(mockReloadService).not.toHaveBeenCalledWith(mockServiceNames.MCP);
    });

    test('org list command should not trigger any reloads', async () => {
      const mockOrgs = [
        { id: 'org1', name: 'Organization 1' },
        { id: 'org2', name: 'Organization 2' },
      ];
      
      mockAuthService.getAvailableOrganizations.mockResolvedValue(mockOrgs);

      const result = await handleSlashCommands('/org list', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Available organizations:');
      expect(result?.output).toContain('org1: Organization 1');
      expect(result?.output).toContain('org2: Organization 2');
      
      // Verify NO reload was triggered
      expect(mockReloadService).not.toHaveBeenCalled();
    });

    test('login failure should not trigger any reloads', async () => {
      const loginError = new Error('Login failed');
      mockAuthService.login.mockRejectedValue(loginError);

      const result = await handleSlashCommands('/login', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Login failed: Login failed');
      
      // Verify NO reload was triggered on failure
      expect(mockReloadService).not.toHaveBeenCalled();
    });

    test('org switch failure should not trigger any reloads', async () => {
      const switchError = new Error('Organization switch failed');
      mockAuthService.switchOrganization.mockRejectedValue(switchError);

      const result = await handleSlashCommands('/org invalid-org', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Failed to switch organization: Organization switch failed');
      
      // Verify NO reload was triggered on failure
      expect(mockReloadService).not.toHaveBeenCalled();
    });
  });

  describe('Other Commands (unchanged behavior)', () => {
    test('help command should work normally', async () => {
      const result = await handleSlashCommands('/help', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toContain('Available commands:');
      expect(result?.output).toContain('/help - Show help');
      expect(result?.output).toContain('/login - Login to Continue');
    });

    test('logout command should exit', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await handleSlashCommands('/logout', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.exit).toBe(true);
      expect(result?.output).toContain('Logged out successfully');
    });

    test('clear command should work normally', async () => {
      const result = await handleSlashCommands('/clear', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.clear).toBe(true);
      expect(result?.output).toBe('Chat history cleared');
    });

    test('non-slash input should return null', async () => {
      const result = await handleSlashCommands('regular input', mockAssistant);
      expect(result).toBeNull();
    });

    test('unknown slash command should return error', async () => {
      const result = await handleSlashCommands('/unknown', mockAssistant);

      expect(result).not.toBeNull();
      expect(result?.output).toBe('Unknown command: unknown');
    });
  });
});
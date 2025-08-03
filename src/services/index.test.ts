import { jest } from '@jest/globals';

import { initializeServices } from './index.js';
import { modeService } from './ModeService.js';
import { serviceContainer } from './ServiceContainer.js';

describe('initializeServices', () => {
  let mockModeService: any;
  let mockServiceContainer: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock mode service
    mockModeService = {
      initialize: jest.fn(),
      getCurrentMode: jest.fn()
    };
    
    // Create mock service container to prevent actual service registration
    mockServiceContainer = {
      register: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      reload: jest.fn(),
      isReady: jest.fn(),
      getServiceStates: jest.fn()
    };
    
    // Set up modeService mock
    (modeService as any).initialize = mockModeService.initialize;
    (modeService as any).getCurrentMode = mockModeService.getCurrentMode;
    
    // Set up serviceContainer mock to prevent actual service initialization
    (serviceContainer as any).register = mockServiceContainer.register;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mode conversion', () => {
    it('should pass only readonly flag for plan mode', async () => {
      await initializeServices({
        headless: true, // Force headless mode to skip onboarding
        toolPermissionOverrides: {
          mode: 'plan',
          allow: ['tool1'],
          ask: ['tool2'],
          exclude: ['tool3']
        }
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ['tool1'],
        ask: ['tool2'],
        exclude: ['tool3'],
        readonly: true
        // auto should NOT be set
      });
    });

    it('should pass only auto flag for auto mode', async () => {
      await initializeServices({
        headless: true, // Force headless mode to skip onboarding
        toolPermissionOverrides: {
          mode: 'auto',
          allow: ['tool1'],
          ask: ['tool2'],
          exclude: ['tool3']
        }
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ['tool1'],
        ask: ['tool2'],
        exclude: ['tool3'],
        auto: true
        // readonly should NOT be set
      });
    });

    it('should pass no mode flags for normal mode', async () => {
      await initializeServices({
        headless: true, // Force headless mode to skip onboarding
        toolPermissionOverrides: {
          mode: 'normal',
          allow: ['tool1'],
          ask: ['tool2'],
          exclude: ['tool3']
        }
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ['tool1'],
        ask: ['tool2'],
        exclude: ['tool3']
        // Neither readonly nor auto should be set
      });
    });

    it('should pass no mode flags when mode is undefined', async () => {
      await initializeServices({
        headless: true, // Force headless mode to skip onboarding
        toolPermissionOverrides: {
          allow: ['tool1'],
          ask: ['tool2'],
          exclude: ['tool3']
        }
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ['tool1'],
        ask: ['tool2'],
        exclude: ['tool3']
        // Neither readonly nor auto should be set
      });
    });

    it('should not call initialize when no toolPermissionOverrides provided', async () => {
      await initializeServices({ headless: true }); // Force headless mode to skip onboarding
      
      expect(mockModeService.initialize).not.toHaveBeenCalled();
    });
  });
});
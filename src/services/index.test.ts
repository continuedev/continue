import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { initializeServices } from './index.js';
import { ModeService } from './ModeService.js';

// Mock dependencies
jest.mock('./ServiceRegistry.js');
jest.mock('./ToolPermissionService.js');
jest.mock('../util/logger.js');

describe('initializeServices', () => {
  let mockModeService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock mode service
    mockModeService = {
      initialize: jest.fn(),
      getCurrentMode: jest.fn()
    };
    
    // Set up getInstance to return our mock
    (ModeService.getInstance as jest.Mock).mockReturnValue(mockModeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mode conversion', () => {
    it('should pass only readonly flag for plan mode', async () => {
      await initializeServices({
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
      await initializeServices({});
      
      expect(mockModeService.initialize).not.toHaveBeenCalled();
    });
  });
});
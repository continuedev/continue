import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { ModeService } from './ModeService.js';
import { PermissionMode } from '../permissions/types.js';

describe('ModeService', () => {
  let modeService: ModeService;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ModeService as any).instance = undefined;
    modeService = ModeService.getInstance();
  });

  afterEach(() => {
    // Clean up singleton instance
    (ModeService as any).instance = undefined;
  });

  describe('initialization', () => {
    it('should initialize with normal mode by default', () => {
      modeService.initialize({});
      expect(modeService.getCurrentMode()).toBe('normal');
    });

    it('should convert readonly flag to plan mode', () => {
      modeService.initialize({ readonly: true });
      expect(modeService.getCurrentMode()).toBe('plan');
    });


    it('should initialize tool permission service', () => {
      modeService.initialize({ allow: ['testTool'], exclude: ['badTool'] });
      const toolPermissionService = modeService.getToolPermissionService();
      expect(toolPermissionService).toBeDefined();
      expect(toolPermissionService.getState()).toBeDefined();
    });
  });

  describe('mode switching', () => {
    beforeEach(() => {
      modeService.initialize({});
    });

    it('should switch from normal to plan mode', () => {
      expect(modeService.getCurrentMode()).toBe('normal');
      modeService.switchMode('plan');
      expect(modeService.getCurrentMode()).toBe('plan');
    });

    it('should switch from plan to auto mode', () => {
      modeService.switchMode('plan');
      expect(modeService.getCurrentMode()).toBe('plan');
      modeService.switchMode('auto');
      expect(modeService.getCurrentMode()).toBe('auto');
    });

    it('should switch to auto mode', () => {
      modeService.switchMode('auto');
      expect(modeService.getCurrentMode()).toBe('auto');
    });

    it('should switch back to normal mode', () => {
      modeService.switchMode('plan');
      modeService.switchMode('normal');
      expect(modeService.getCurrentMode()).toBe('normal');
    });

    it('should update tool permission service when switching modes', () => {
      const toolPermissionService = modeService.getToolPermissionService();
      const initialState = toolPermissionService.getState();
      
      modeService.switchMode('auto');
      const newState = toolPermissionService.getState();
      
      expect(newState.currentMode).toBe('auto');
      expect(newState.permissions.policies.length).toBeGreaterThan(0);
      expect(newState.permissions.policies[0]).toEqual({
        tool: '*',
        permission: 'allow'
      });
    });
  });

  describe('available modes', () => {
    beforeEach(() => {
      modeService.initialize({});
    });

    it('should return all available modes with descriptions', () => {
      const modes = modeService.getAvailableModes();
      expect(modes).toHaveLength(3);
      
      const modeNames = modes.map(m => m.mode);
      expect(modeNames).toContain('normal');
      expect(modeNames).toContain('plan');
      expect(modeNames).toContain('auto');
      
      // Check that all modes have descriptions
      modes.forEach(mode => {
        expect(mode.description).toBeDefined();
        expect(mode.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = ModeService.getInstance();
      const instance2 = ModeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = ModeService.getInstance();
      instance1.initialize({});
      instance1.switchMode('plan');
      
      const instance2 = ModeService.getInstance();
      expect(instance2.getCurrentMode()).toBe('plan');
    });
  });

  describe('event emission', () => {
    let modeChangeListener: jest.Mock;

    beforeEach(() => {
      modeService.initialize({});
      modeChangeListener = jest.fn();
      modeService.on('modeChanged', modeChangeListener);
    });

    afterEach(() => {
      modeService.off('modeChanged', modeChangeListener);
    });

    it('should emit modeChanged event when mode switches', () => {
      modeService.switchMode('plan');
      
      expect(modeChangeListener).toHaveBeenCalledWith('plan', 'normal');
      expect(modeChangeListener).toHaveBeenCalledTimes(1);
    });

    it('should emit event with correct previous and new modes', () => {
      modeService.switchMode('plan');
      modeChangeListener.mockClear();
      
      modeService.switchMode('auto');
      
      expect(modeChangeListener).toHaveBeenCalledWith('auto', 'plan');
      expect(modeChangeListener).toHaveBeenCalledTimes(1);
    });

    it('should not emit event when switching to same mode', () => {
      modeService.switchMode('plan');
      modeChangeListener.mockClear();
      
      modeService.switchMode('plan');
      
      expect(modeChangeListener).not.toHaveBeenCalled();
    });
  });
});
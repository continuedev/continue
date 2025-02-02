import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Shortcut from './Shortcut';
import * as util from '../../util';

// Mock the utility functions
vi.mock('../../util', () => ({
  ...vi.importActual('../../util'),
  getPlatform: vi.fn(),
  getMetaKeyLabel: vi.fn(),
  getAltKeyLabel: vi.fn(),
  getFontSize: vi.fn(),
}));

describe('Shortcut component', () => {
  const originalGetPlatform = util.getPlatform;
  const originalGetMetaKeyLabel = util.getMetaKeyLabel;
  const originalGetFontSize = util.getFontSize;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Meta key rendering across platforms', () => {
    const metaKeyInputs = ['meta', 'cmd', 'ctrl', '^', '⌘'];
    const platforms = ['windows', 'mac', 'linux'];

    platforms.forEach((platform) => {
      metaKeyInputs.forEach((metaKey) => {
        it(`should render "${metaKey}" as "${platform === 'mac' ? '⌘' : 'Ctrl'}" on ${platform}`, () => {
          // Mock the platform
          vi.mocked(util.getPlatform).mockReturnValue(platform);

          // Mock getMetaKeyLabel based on platform
          vi.mocked(util.getMetaKeyLabel).mockImplementation(() => {
            if (platform === 'mac') return '⌘';
            return 'Ctrl';
          });

          // Render the component
          const { container } = render(<Shortcut>{metaKey}</Shortcut>);

          // Find the rendered <kbd> element
          const kbdElement = container.querySelector('kbd');

          expect(kbdElement?.textContent).toBe(platform === 'mac' ? '⌘' : 'Ctrl');
        });
      });
    });
  });

  describe('Font class application', () => {
    it('should apply "keyboard-key-normal" class for single characters', () => {
      const { container } = render(<Shortcut>a</Shortcut>);
      const kbdElement = container.querySelector('kbd');

      expect(kbdElement).toHaveClass('keyboard-key-normal');
    });

    it('should apply "keyboard-key-special" class for special keys', () => {
      const { container } = render(<Shortcut>Enter</Shortcut>);
      const kbdElement = container.querySelector('kbd');

      expect(kbdElement).toHaveClass('keyboard-key-special');
    });
  });
});
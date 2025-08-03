import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { runNormalFlow } from './onboarding.js';
import type { AuthConfig } from './auth/workos.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('onboarding config flag handling', () => {
  let tempDir: string;
  let mockAuthConfig: AuthConfig;

  beforeEach(() => {
    // Create a temporary directory for test config files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'continue-test-'));
    
    // Create a minimal auth config for testing
    mockAuthConfig = {
      userId: 'test-user',
      userEmail: 'test@example.com',
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() + 3600000,
      organizationId: 'test-org',
    };
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should fail loudly when --config points to non-existent file', async () => {
    const configPath = path.join(tempDir, 'non-existent.yaml');
    
    // Verify the file doesn't exist
    expect(fs.existsSync(configPath)).toBe(false);
    
    // Should throw an error that mentions both the path and the failure
    await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
      /Failed to load config from ".*non-existent\.yaml": .*ENOENT/
    );
  });

  test('should fail loudly when --config points to malformed YAML file', async () => {
    const configPath = path.join(tempDir, 'malformed.yaml');
    
    // Create a malformed YAML file  
    fs.writeFileSync(configPath, `
name: "Test Config"
models:
  - name: "GPT-4"
    provider: "openai"
    invalid_yaml_syntax: [unclosed array
`);
    
    // Verify the file exists
    expect(fs.existsSync(configPath)).toBe(true);
    
    // Should throw an error mentioning the path and failure to load
    await expect(runNormalFlow(mockAuthConfig, configPath)).rejects.toThrow(
      /Failed to load config from ".*malformed\.yaml": .+/
    );
  });

  test('should fail loudly when --config points to file with missing required fields', async () => {
    const configPath = path.join(tempDir, 'incomplete.yaml');
    
    // Create a config file missing required fields
    fs.writeFileSync(configPath, `
name: "Incomplete Config"
# Missing models array and other required fields
`);
    
    // Verify the file exists
    expect(fs.existsSync(configPath)).toBe(true);
    
    try {
      await runNormalFlow(mockAuthConfig, configPath);
      fail('Expected runNormalFlow to throw an error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Must have our specific error format that shows we caught and re-threw
      expect(errorMessage).toMatch(/^Failed to load config from ".*": .+/);
      
      // Must mention the specific config file path
      expect(errorMessage).toContain(configPath);
      
      // Must NOT be a generic fallback error - should be about our specific file
      expect(errorMessage).not.toContain('Unable to find');
      expect(errorMessage).not.toContain('No configuration found');
    }
  });

  test('error message should include the exact config path that was provided', async () => {
    const configPath = './some/relative/path/config.yaml';
    
    try {
      await runNormalFlow(mockAuthConfig, configPath);
      fail('Expected runNormalFlow to throw an error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Should include the exact path that was provided
      expect(errorMessage).toContain(configPath);
      
      // Should have the expected error message format
      expect(errorMessage).toMatch(/Failed to load config from ".*": .+/);
    }
  });

  test('should handle different config path formats', async () => {
    const testPaths = [
      './non-existent.yaml',
      '/absolute/path/config.yaml', 
      '../relative/config.yaml',
      'simple-name.yaml'
    ];
    
    for (const configPath of testPaths) {
      try {
        await runNormalFlow(mockAuthConfig, configPath);
        fail(`Expected runNormalFlow to throw an error for path: ${configPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Each error should mention the specific path
        expect(errorMessage).toContain(configPath);
        expect(errorMessage).toContain('Failed to load config from');
      }
    }
  });

  test('should not fall back to default config when explicit config fails', async () => {
    const configPath = path.join(tempDir, 'bad-config.yaml');
    
    // Create a bad config file
    fs.writeFileSync(configPath, 'invalid: yaml: content: [');
    
    try {
      await runNormalFlow(mockAuthConfig, configPath);
      fail('Expected runNormalFlow to throw an error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // CRITICAL: Must have our specific error format from the fix
      expect(errorMessage).toMatch(/^Failed to load config from ".*": .+/);
      
      // Error should be about the specific config file we provided
      expect(errorMessage).toContain(configPath);
      
      // Should NOT mention falling back to default config (this was the bug!)
      expect(errorMessage).not.toContain('~/.continue/config.yaml');
      expect(errorMessage).not.toContain('default config');
      expect(errorMessage).not.toContain('fallback');
      
      // Should NOT be a generic "config not found" error that would indicate
      // the system tried to fall back to defaults
      expect(errorMessage).not.toContain('Unable to find');
      expect(errorMessage).not.toContain('No configuration found');
    }
  });

  test('demonstrates the fix: explicit config failure vs no config provided', async () => {
    const badConfigPath = path.join(tempDir, 'bad.yaml');
    fs.writeFileSync(badConfigPath, 'invalid yaml [');
    
    // Case 1: Explicit --config that fails should throw our specific error
    try {
      await runNormalFlow(mockAuthConfig, badConfigPath);
      fail('Expected explicit config to fail');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // This should have our "Failed to load config from" prefix
      expect(errorMessage).toMatch(/^Failed to load config from "/);
      expect(errorMessage).toContain(badConfigPath);
    }
    
    // Case 2: No explicit config should follow different logic (might succeed or fail differently)
    try {
      await runNormalFlow(mockAuthConfig, undefined);
      // If it succeeds, that's fine - the point is it's different behavior
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // This should NOT have our "Failed to load config from" prefix
      // because no explicit config was provided
      expect(errorMessage).not.toMatch(/^Failed to load config from "/);
    }
  });
});
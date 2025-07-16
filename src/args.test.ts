import { parseArgs } from './args.js';

describe('parseArgs', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    // Reset process.argv before each test
    process.argv = ['node', 'script.js'];
  });

  afterAll(() => {
    // Restore original argv
    process.argv = originalArgv;
  });

  it('should return default values when no arguments provided', () => {
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: false,
    });
  });

  it('should set isHeadless to true when --headless flag is present', () => {
    process.argv = ['node', 'script.js', '--headless'];
    const result = parseArgs();
    expect(result.isHeadless).toBe(true);
  });

  it('should set resume to true when --resume flag is present', () => {
    process.argv = ['node', 'script.js', '--resume'];
    const result = parseArgs();
    expect(result.resume).toBe(true);
  });

  it('should set readonly to true when --readonly flag is present', () => {
    process.argv = ['node', 'script.js', '--readonly'];
    const result = parseArgs();
    expect(result.readonly).toBe(true);
  });

  it('should set noTools to true when --no-tools flag is present', () => {
    process.argv = ['node', 'script.js', '--no-tools'];
    const result = parseArgs();
    expect(result.noTools).toBe(true);
  });

  it('should parse config path from --config flag', () => {
    process.argv = ['node', 'script.js', '--config', '/path/to/config.yaml'];
    const result = parseArgs();
    expect(result.configPath).toBe('/path/to/config.yaml');
  });

  it('should parse prompt from last non-flag argument', () => {
    process.argv = ['node', 'script.js', 'Hello world'];
    const result = parseArgs();
    expect(result.prompt).toBe('Hello world');
  });

  it('should handle multiple flags together', () => {
    process.argv = ['node', 'script.js', '--headless', '--readonly', '--resume'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: true,
      readonly: true,
      resume: true,
    });
  });

  it('should handle config flag with other flags', () => {
    process.argv = ['node', 'script.js', '--config', 'config.yaml', '--headless'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: true,
      configPath: 'config.yaml',
    });
  });

  it('should handle prompt with flags', () => {
    process.argv = ['node', 'script.js', '--headless', 'What is the weather?'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: true,
      prompt: 'What is the weather?',
    });
  });

  it('should handle config flag with prompt', () => {
    process.argv = ['node', 'script.js', '--config', 'config.yaml', 'Test prompt'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: false,
      configPath: 'config.yaml',
      prompt: 'Test prompt',
    });
  });

  it('should ignore config flag value when extracting prompt', () => {
    process.argv = ['node', 'script.js', '--config', 'config.yaml', 'actual-prompt'];
    const result = parseArgs();
    expect(result.prompt).toBe('actual-prompt');
    expect(result.configPath).toBe('config.yaml');
  });

  it('should handle multiple non-flag arguments and use the last one as prompt', () => {
    process.argv = ['node', 'script.js', 'first', 'second', 'third'];
    const result = parseArgs();
    expect(result.prompt).toBe('third');
  });

  it('should handle complex argument combinations', () => {
    process.argv = ['node', 'script.js', '--headless', '--config', 'my-config.yaml', '--readonly', '--resume', 'Complex prompt with spaces'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: true,
      configPath: 'my-config.yaml',
      readonly: true,
      resume: true,
      prompt: 'Complex prompt with spaces',
    });
  });

  it('should handle config flag without value', () => {
    process.argv = ['node', 'script.js', '--config'];
    const result = parseArgs();
    expect(result.configPath).toBeUndefined();
  });

  it('should handle config flag at the end without value', () => {
    process.argv = ['node', 'script.js', '--headless', '--config'];
    const result = parseArgs();
    expect(result.isHeadless).toBe(true);
    expect(result.configPath).toBeUndefined();
  });

  it('should handle empty arguments array', () => {
    process.argv = ['node', 'script.js'];
    const result = parseArgs();
    expect(result).toEqual({
      isHeadless: false,
    });
  });

  it('should handle flags with similar names', () => {
    process.argv = ['node', 'script.js', '--no-tools', '--readonly'];
    const result = parseArgs();
    expect(result.noTools).toBe(true);
    expect(result.readonly).toBe(true);
  });
});
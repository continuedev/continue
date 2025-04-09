import { getSecureID } from '../getSecureID';

// Mock the crypto.randomUUID function
const mockRandomUUID = jest.fn();
global.crypto = {
  ...global.crypto,
  randomUUID: mockRandomUUID
};

describe('getSecureID', () => {
  beforeEach(() => {
    // Reset the static property before each test
    (getSecureID as any).uuid = undefined;

    // Reset the mock implementation
    mockRandomUUID.mockReset();
    // Setup a mock implementation that returns a fixed value for testing
    mockRandomUUID.mockReturnValue('test-uuid-1234');
  });

  test('should generate a UUID on first call', () => {
    const result = getSecureID();
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    expect(result).toBe('<!-- SID: test-uuid-1234 -->');
  });

  test('should reuse the same UUID on subsequent calls', () => {
    const firstResult = getSecureID();
    const secondResult = getSecureID();

    // The UUID generation should only happen once
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);

    // Both results should be identical
    expect(firstResult).toBe(secondResult);
    expect(firstResult).toBe('<!-- SID: test-uuid-1234 -->');
  });

  test('should maintain the same UUID across different test cases if not reset', () => {
    // Don't reset the UUID here to test persistence
    (getSecureID as any).uuid = 'persistent-uuid';

    const result = getSecureID();

    // No new UUID should be generated
    expect(mockRandomUUID).not.toHaveBeenCalled();
    expect(result).toBe('<!-- SID: persistent-uuid -->');
  });
});
import { v4 as uuidv4 } from "uuid";
import { getSecureID } from "./getSecureID";

// Mock the uuid function
jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

describe("getSecureID", () => {
  beforeEach(() => {
    // Reset the static property before each test
    (getSecureID as any).uuid = undefined;

    // Reset the mock implementation
    mockUuidv4.mockReset();
    // Setup a mock implementation that returns a fixed value for testing
    mockUuidv4.mockReturnValue("test-uuid-1234");
  });

  test("should generate a UUID on first call", () => {
    const result = getSecureID();
    expect(mockUuidv4).toHaveBeenCalledTimes(1);
    expect(result).toBe("<!-- SID: test-uuid-1234 -->");
  });

  test("should reuse the same UUID on subsequent calls", () => {
    const firstResult = getSecureID();
    const secondResult = getSecureID();

    // The UUID generation should only happen once
    expect(mockUuidv4).toHaveBeenCalledTimes(1);

    // Both results should be identical
    expect(firstResult).toBe(secondResult);
    expect(firstResult).toBe("<!-- SID: test-uuid-1234 -->");
  });

  test("should maintain the same UUID across different test cases if not reset", () => {
    // Don't reset the UUID here to test persistence
    (getSecureID as any).uuid = "persistent-uuid";

    const result = getSecureID();

    // No new UUID should be generated
    expect(mockUuidv4).not.toHaveBeenCalled();
    expect(result).toBe("<!-- SID: persistent-uuid -->");
  });
});

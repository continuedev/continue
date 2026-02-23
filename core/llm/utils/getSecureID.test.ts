import { getSecureID } from "./getSecureID";

describe("getSecureID", () => {
  beforeEach(() => {
    // Reset the static property before each test
    (getSecureID as any).uuid = undefined;
  });

  test("should generate a UUID on first call", () => {
    const result = getSecureID();

    // Should return a properly formatted string with SID comment
    expect(result).toMatch(
      /^<!-- SID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12} -->$/,
    );

    // Should have set the static uuid property
    expect((getSecureID as any).uuid).toBeDefined();
    expect(typeof (getSecureID as any).uuid).toBe("string");
  });

  test("should reuse the same UUID on subsequent calls", () => {
    const firstResult = getSecureID();
    const secondResult = getSecureID();

    // Both results should be identical
    expect(firstResult).toBe(secondResult);

    // Should match UUID format
    expect(firstResult).toMatch(
      /^<!-- SID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12} -->$/,
    );
  });

  test("should maintain the same UUID across different test cases if not reset", () => {
    // Set a specific UUID to test persistence
    (getSecureID as any).uuid = "persistent-uuid";

    const result = getSecureID();

    // Should use the pre-existing UUID
    expect(result).toBe("<!-- SID: persistent-uuid -->");

    // The static property should remain unchanged
    expect((getSecureID as any).uuid).toBe("persistent-uuid");
  });
});

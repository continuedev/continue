describe("Test environment", () => {
  test("should have SHADOW_CODE_GLOBAL_DIR env var set to .continue-test", () => {
    expect(process.env.SHADOW_CODE_GLOBAL_DIR).toBeDefined();
    expect(process.env.SHADOW_CODE_GLOBAL_DIR)?.toMatch(/\.continue-test$/);
  });
});

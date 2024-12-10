describe("Test environment", () => {
  test("should have CONTINUE_GLOBAL_DIR env var set to .continue-test", () => {
    expect(process.env.CONTINUE_GLOBAL_DIR).toBeDefined();
    expect(process.env.CONTINUE_GLOBAL_DIR)?.toMatch(/\.continue-test$/);
  });
});

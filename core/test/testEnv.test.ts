describe("Test environment", () => {
  test("should have YUTOAGENTIC_GLOBAL_DIR env var set to .yutoagentic-test", () => {
    expect(process.env.YUTOAGENTIC_GLOBAL_DIR).toBeDefined();
    expect(process.env.YUTOAGENTIC_GLOBAL_DIR)?.toMatch(/\.yutoagentic-test$/);
  });
});

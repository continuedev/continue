import { MessageIde } from "./messageIde";

describe("MessageIde", () => {
  it("passes maxResults to getFileResults requests", async () => {
    const request = jest.fn().mockResolvedValue(["src/index.ts"]);
    const ide = new MessageIde(request as any, jest.fn() as any);

    await ide.getFileResults("**/*.ts", 100);

    expect(request).toHaveBeenCalledWith("getFileResults", {
      pattern: "**/*.ts",
      maxResults: 100,
    });
  });
});

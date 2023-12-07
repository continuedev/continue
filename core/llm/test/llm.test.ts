import FreeTrial from "../llms/FreeTrial";

describe("FreeTrial", () => {
  let freeTrial: FreeTrial;
  // Setup
  beforeAll(() => {
    freeTrial = new FreeTrial({
      uniqueId: "None",
      model: "gpt-3.5-turbo",
    });
  });

  test("Stream Chat works", async () => {
    let total = "";
    for await (const chunk of freeTrial.streamChat([
      { role: "user", content: "Hello" },
    ])) {
      total += chunk.content;
    }

    expect(total.length).toBeGreaterThan(0);
    return;
  });

  test("Stream Complete works", async () => {
    let total = "";
    for await (const chunk of freeTrial.streamComplete("Hello")) {
      total += chunk;
    }

    expect(total.length).toBeGreaterThan(0);
    return;
  });

  test("Complete works", async () => {
    const completion = await freeTrial.complete("Hello");

    expect(completion.length).toBeGreaterThan(0);
    return;
  });
});

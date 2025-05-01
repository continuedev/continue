import { expect } from "@jest/globals";
import dotenv from "dotenv";
import { Continue } from "../src/Continue";

dotenv.config();

test("should make a real API call to the Continue service", async () => {
  const apiKey = process.env.CONTINUE_API_KEY;

  if (!apiKey) {
    throw new Error("CONTINUE_API_KEY not found in environment variables");
  }

  /*
   * This assumes you are running the control plane API locally,
   * are using the e2e test user, have an assistant with slug
   * `assistant1`, and that assistant is using a valid Claude
   * 3.7 Sonnet block with a valid API key.
   */
  const assistantSlug = "peter-parker/assistant1";
  const modelName = "claude-3-7-sonnet-latest";

  const { client, assistant } = await Continue.from({
    apiKey,
    assistant: assistantSlug,
    baseURL: "http://localhost:3001",
  });

  const response = await client?.chat.completions.create({
    model: assistant.getModel(modelName),
    messages: [
      { role: "system", content: assistant.systemMessage },
      { role: "user", content: "Hello!" },
    ],
  });

  if (!response) {
    throw new Error("No response from the API");
  }

  console.log("Response:", response.choices[0].message);

  // Verify we got a meaningful response
  expect(response).toBeDefined();
  expect(response.choices).toBeDefined();
  expect(response.choices.length).toBeGreaterThan(0);
  expect(response.choices[0].message).toBeDefined();
  expect(response.choices[0].message.content).toBeTruthy();
});

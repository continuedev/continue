import { ModelDescription } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { getBaseSystemMessage } from "./getBaseSystemMessage";

test("getBaseSystemMessage should return the correct system message based on mode - no tools", () => {
  const mockModel = {
    baseAgentSystemMessage: "Custom Agent System Message",
    baseChatSystemMessage: "Custom Chat System Message",
  } as ModelDescription;

  // Test agent mode with custom message
  expect(getBaseSystemMessage("agent", mockModel, [])).toBe(
    "Custom Agent System Message",
  );

  // Test chat mode with custom message
  expect(getBaseSystemMessage("chat", mockModel, [])).toBe(
    "Custom Chat System Message",
  );

  // Test agent mode with default message
  expect(getBaseSystemMessage("agent", {} as ModelDescription, [])).toBe(
    DEFAULT_AGENT_SYSTEM_MESSAGE,
  );

  // Test chat mode with default message
  expect(getBaseSystemMessage("chat", {} as ModelDescription, [])).toBe(
    DEFAULT_CHAT_SYSTEM_MESSAGE,
  );
});

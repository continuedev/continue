import { SerializedContinueConfig } from "..";

const defaultConfig: SerializedContinueConfig = {
  models: [
    {
      title: "GPT-4 (Free Trial)",
      provider: "free-trial",
      model: "gpt-4",
    },
    {
      title: "GPT-4 Vision (Free Trial)",
      provider: "free-trial",
      model: "gpt-4-vision-preview",
    },
    {
      title: "Phind CodeLlama (Free Trial)",
      provider: "free-trial",
      model: "phind-codellama-34b",
    },
    {
      title: "Gemini Pro (Free Trial)",
      provider: "free-trial",
      model: "gemini-pro",
    },
  ],
  slashCommands: [
    {
      name: "edit",
      description: "Edit selected code",
    },
    {
      name: "comment",
      description: "Write comments for the selected code",
    },
    {
      name: "share",
      description: "Download and share this session",
    },
    {
      name: "cmd",
      description: "Generate a shell command",
    },
  ],
  customCommands: [
    {
      name: "test",
      prompt:
        "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      description: "Write unit tests for highlighted code",
    },
  ],
  contextProviders: [
    { name: "diff", params: {} },
    {
      name: "open",
      params: {},
    },
    { name: "terminal", params: {} },
    { name: "problems", params: {} },
  ],
};

export default defaultConfig;

import { SerializedContinueConfig } from "..";

const defaultConfig: SerializedContinueConfig = {
  models: [
    {
      title: "GPT-4",
      provider: "free-trial",
      model: "gpt-4",
    },
    {
      title: "GPT-3.5-Turbo",
      provider: "free-trial",
      model: "gpt-3.5-turbo",
    },
    {
      title: "Phind CodeLlama",
      provider: "free-trial",
      model: "phind-codellama-34b",
    },
    {
      title: "Gemini Pro",
      provider: "free-trial",
      model: "gemini-pro",
    },
  ],
  slashCommands: [
    {
      name: "edit",
      description: "Edit highlighted code",
    },
    {
      name: "comment",
      description: "Write comments for the highlighted code",
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

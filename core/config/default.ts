import { SerializedContinueConfig } from "..";

const defaultConfig: SerializedContinueConfig = {
  models: [
    {
      title: "GPT-4",
      provider: "openai-free-trial",
      model: "gpt-4",
    },
    {
      title: "GPT-3.5-Turbo",
      provider: "openai-free-trial",
      model: "gpt-3.5-turbo",
    },
  ],
  modelRoles: {
    default: "GPT-4",
    summarize: "GPT-3.5-Turbo",
  },
  slashCommands: [
    {
      name: "edit",
      description: "Edit highlighted code",
      step: "EditHighlightedCodeStep",
    },
    {
      name: "comment",
      description: "Write comments for the highlighted code",
      step: "CommentCodeStep",
    },
    {
      name: "share",
      description: "Download and share this session",
      step: "ShareSessionStep",
    },
    {
      name: "cmd",
      description: "Generate a shell command",
      step: "GenerateShellCommandStep",
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
};

export default defaultConfig;

import { ChatCompletion } from "openai/resources/index";

export const EMPTY_CHAT_COMPLETION: ChatCompletion = {
  choices: [
    {
      finish_reason: "stop",
      index: 0,
      logprobs: null,
      message: {
        content: null,
        role: "assistant",
        refusal: null,
      },
    },
  ],
  usage: undefined,
  created: Date.now(),
  id: "",
  model: "UNSPECIFIED",
  object: "chat.completion",
};

import { CustomCommand, SlashCommandDescription } from "../config";
import { IDE } from "../ide/types";
import { LLM } from "../llm";
import { ChatMessage, ContextItem } from "../llm/types";
import SlashCommands from "./slash";
export interface ContinueSDK {
  ide: IDE;
  llm: LLM;
  addContextItem: (item: ContextItem) => void;
  history: ChatMessage[];
  input: string;
  params?: any;
  contextItems: ContextItem[];
}

export interface SlashCommand {
  name: string;
  description: string;
  params?: { [key: string]: any };
  run: (sdk: ContinueSDK) => AsyncGenerator<string | undefined>;
}

export function slashFromCustomCommand(
  customCommand: CustomCommand
): SlashCommand {
  return {
    name: customCommand.name,
    description: customCommand.description,
    run: async function* ({ input, llm, history }) {
      const promptUserInput = `Task: ${customCommand.prompt}. Additional info: ${input}`;
      const messages = [...history];
      // Find the last chat message with this slash command and replace it with the user input
      for (let i = messages.length - 1; i >= 0; i--) {
        if (
          messages[i].role === "user" &&
          messages[i].content.startsWith(`/${customCommand.name}`)
        ) {
          messages[i] = { ...messages[i], content: promptUserInput };
          break;
        }
      }

      for await (const chunk of llm.streamChat(messages)) {
        yield chunk.content;
      }
    },
  };
}

export function slashCommandFromDescription(
  desc: SlashCommandDescription
): SlashCommand | undefined {
  const cmd = SlashCommands.find((cmd) => cmd.name === desc.name);
  if (!cmd) {
    return undefined;
  }
  return {
    ...cmd,
    params: desc.params,
  };
}

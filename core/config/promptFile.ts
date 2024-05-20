import * as YAML from "yaml";
import { IDE, SlashCommand } from "..";
import { stripImages } from "../llm/countTokens";
import { renderTemplatedString } from "../llm/llms";
import { getBasename } from "../util";

export async function getPromptFiles(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const paths = await ide.listWorkspaceContents(dir);
    const results = paths.map(async (path) => {
      const content = await ide.readFile(path);
      return { path, content };
    });
    return Promise.all(results);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function slashCommandFromPromptFile(
  path: string,
  content: string,
): SlashCommand {
  let [preambleRaw, prompt] = content.split("\n---\n");
  if (prompt === undefined) {
    prompt = preambleRaw;
    preambleRaw = "";
  }

  const preamble = YAML.parse(preambleRaw) ?? {};
  const name = preamble.name ?? getBasename(path).split(".prompt")[0];
  const description = preamble.description ?? name;

  let systemMessage: string | undefined = undefined;
  if (prompt.includes("<system>")) {
    systemMessage = prompt.split("<system>")[1].split("</system>")[0].trim();
    prompt = prompt.split("</system>")[1].trim();
  }

  return {
    name,
    description,
    run: async function* ({ input, llm, history, ide }) {
      // Remove slash command prefix from input
      let userInput = input;
      if (userInput.startsWith(`/${name}`)) {
        userInput = userInput
          .slice(name.length + 1, userInput.length)
          .trimStart();
      }

      // Render prompt template
      const diff = await ide.getDiff();
      const promptUserInput = await renderTemplatedString(
        prompt,
        ide.readFile.bind(ide),
        { input: userInput, diff },
      );

      const messages = [...history];
      // Find the last chat message with this slash command and replace it with the user input
      for (let i = messages.length - 1; i >= 0; i--) {
        const { role, content } = messages[i];
        if (role !== "user") {
          continue;
        }

        if (
          Array.isArray(content) &&
          content.some((part) => part.text?.startsWith(`/${name}`))
        ) {
          messages[i] = {
            ...messages[i],
            content: content.map((part) => {
              return part.text?.startsWith(`/${name}`)
                ? { ...part, text: promptUserInput }
                : part;
            }),
          };
          break;
        } else if (
          typeof content === "string" &&
          content.startsWith(`/${name}`)
        ) {
          messages[i] = { ...messages[i], content: promptUserInput };
          break;
        }
      }

      // System message
      if (systemMessage) {
        if (messages[0]?.role === "system") {
          messages[0].content = systemMessage;
        } else {
          messages.unshift({ role: "system", content: systemMessage });
        }
      }

      for await (const chunk of llm.streamChat(messages)) {
        yield stripImages(chunk.content);
      }
    },
  };
}

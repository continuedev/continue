import Handlebars from "handlebars";
import path from "path";
import * as YAML from "yaml";
import type { IDE, SlashCommand } from "..";
import { walkDir } from "../indexing/walkDir";
import { stripImages } from "../llm/countTokens.js";
import { renderTemplatedString } from "../llm/llms/index.js";
import { getBasename } from "../util/index.js";

export const DEFAULT_PROMPTS_FOLDER = ".prompts";

export async function getPromptFiles(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);
    if (!exists) {
      return [];
    }

    const paths = await walkDir(dir, ide, { ignoreFiles: [] });
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

const DEFAULT_PROMPT_FILE = `# This is an example ".prompt" file
# It is used to define and reuse prompts within Continue
# Continue will automatically create a slash command for each prompt in the .prompts folder
# To learn more, see the full .prompt file reference: https://docs.continue.dev/walkthroughs/prompt-files
temperature: 0.0
---
{{{ diff }}}

Give me feedback on the above changes. For each file, you should output a markdown section including the following:
- If you found any problems, an h3 like "❌ <filename>"
- If you didn't find any problems, an h3 like "✅ <filename>"
- If you found any problems, add below a bullet point description of what you found, including a minimal code snippet explaining how to fix it
- If you didn't find any problems, you don't need to add anything else

Here is an example. The example is surrounded in backticks, but your response should not be:

\`\`\`
### ✅ <Filename1>

### ❌ <Filename2>

<Description>
\`\`\`

You should look primarily for the following types of issues, and only mention other problems if they are highly pressing.

- console.logs that have been left after debugging
- repeated code
- algorithmic errors that could fail under edge cases
- something that could be refactored

Make sure to review ALL files that were changed, do not skip any.
`;

export async function createNewPromptFile(
  ide: IDE,
  promptPath: string | undefined,
): Promise<void> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error(
      "No workspace directories found. Make sure you've opened a folder in your IDE.",
    );
  }
  const promptFilePath = path.join(
    workspaceDirs[0],
    promptPath ?? DEFAULT_PROMPTS_FOLDER,
    "new-prompt-file.prompt",
  );

  await ide.writeFile(promptFilePath, DEFAULT_PROMPT_FILE);
  await ide.openFile(promptFilePath);
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
    run: async function* ({
      input,
      llm,
      history,
      ide,
      config,
      fetch,
      selectedCode,
      addContextItem,
    }) {
      // Remove slash command prefix from input
      let userInput = input;
      if (userInput.startsWith(`/${name}`)) {
        userInput = userInput
          .slice(name.length + 1, userInput.length)
          .trimStart();
      }

      // Render prompt template
      const helpers: [string, Handlebars.HelperDelegate][] | undefined =
        config.contextProviders?.map((provider) => {
          return [
            provider.description.title,
            async (context: any) => {
              const items = await provider.getContextItems(context, {
                embeddingsProvider: config.embeddingsProvider,
                fetch,
                fullInput: userInput,
                ide,
                llm,
                reranker: config.reranker,
                selectedCode,
              });
              items.forEach((item) =>
                addContextItem({
                  ...item,
                  id: {
                    itemId: item.description,
                    providerTitle: provider.description.title,
                  },
                }),
              );
              return items.map((item) => item.content).join("\n\n");
            },
          ];
        });

      // A few context providers that don't need to be in config.json to work in .prompt files
      const diff = await ide.getDiff();
      const currentFilePath = await ide.getCurrentFile();
      const promptUserInput = await renderTemplatedString(
        prompt,
        ide.readFile.bind(ide),
        {
          input: userInput,
          diff,
          currentFile: currentFilePath
            ? await ide.readFile(currentFilePath)
            : undefined,
        },
        helpers,
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

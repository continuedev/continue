import Handlebars from "handlebars";
import path from "path";
import * as YAML from "yaml";
import type { IDE, SlashCommand } from "..";
import { walkDir } from "../indexing/walkDir";
import { stripImages } from "../llm/images";
import { renderTemplatedString } from "../promptFiles/renderTemplatedString";
import { getBasename } from "../util/index";

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
# To learn more, see the full .prompt file reference: https://docs.continue.dev/features/prompt-files
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
  const { name, description, systemMessage, prompt } = parsePromptFile(
    path,
    content,
  );

  return {
    name,
    description,
    run: async function* (context) {
      const originalSystemMessage = context.llm.systemMessage;
      context.llm.systemMessage = systemMessage;

      const userInput = extractUserInput(context.input, name);
      const renderedPrompt = await renderPrompt(prompt, context, userInput);
      const messages = updateChatHistory(
        context.history,
        name,
        renderedPrompt,
        systemMessage,
      );

      for await (const chunk of context.llm.streamChat(messages)) {
        yield stripImages(chunk.content);
      }

      context.llm.systemMessage = originalSystemMessage;
    },
  };
}

function parsePromptFile(path: string, content: string) {
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

  return { name, description, systemMessage, prompt };
}

function extractUserInput(input: string, commandName: string): string {
  if (input.startsWith(`/${commandName}`)) {
    return input.slice(commandName.length + 1).trimStart();
  }
  return input;
}

async function renderPrompt(prompt: string, context: any, userInput: string) {
  const helpers = getContextProviderHelpers(context);

  // A few context providers that don't need to be in config.json to work in .prompt files
  const diff = await context.ide.getDiff(false);
  const currentFilePath = await context.ide.getCurrentFile();
  const currentFile = currentFilePath
    ? await context.ide.readFile(currentFilePath)
    : undefined;

  return renderTemplatedString(
    prompt,
    context.ide.readFile.bind(context.ide),
    { diff, currentFile, input: userInput },
    helpers,
  );
}

function getContextProviderHelpers(
  context: any,
): Array<[string, Handlebars.HelperDelegate]> | undefined {
  return context.config.contextProviders?.map((provider: any) => [
    provider.description.title,
    async (helperContext: any) => {
      const items = await provider.getContextItems(helperContext, {
        config: context.config,
        embeddingsProvider: context.config.embeddingsProvider,
        fetch: context.fetch,
        fullInput: context.input,
        ide: context.ide,
        llm: context.llm,
        reranker: context.config.reranker,
        selectedCode: context.selectedCode,
      });

      items.forEach((item: any) =>
        context.addContextItem(createContextItem(item, provider)),
      );

      return items.map((item: any) => item.content).join("\n\n");
    },
  ]);
}

function createContextItem(item: any, provider: any) {
  return {
    ...item,
    id: {
      itemId: item.description,
      providerTitle: provider.description.title,
    },
  };
}

function updateChatHistory(
  history: any[],
  commandName: string,
  renderedPrompt: string,
  systemMessage?: string,
) {
  const messages = [...history];

  for (let i = messages.length - 1; i >= 0; i--) {
    const { role, content } = messages[i];
    if (role !== "user") {
      continue;
    }

    if (Array.isArray(content)) {
      if (content.some((part) => part.text?.startsWith(`/${commandName}`))) {
        messages[i] = updateArrayContent(
          messages[i],
          commandName,
          renderedPrompt,
        );
        break;
      }
    } else if (
      typeof content === "string" &&
      content.startsWith(`/${commandName}`)
    ) {
      messages[i] = { ...messages[i], content: renderedPrompt };
      break;
    }
  }

  if (systemMessage) {
    messages[0]?.role === "system"
      ? (messages[0].content = systemMessage)
      : messages.unshift({ role: "system", content: systemMessage });
  }

  return messages;
}

function updateArrayContent(
  message: any,
  commandName: string,
  renderedPrompt: string,
) {
  return {
    ...message,
    content: message.content.map((part: any) =>
      part.text?.startsWith(`/${commandName}`)
        ? { ...part, text: renderedPrompt }
        : part,
    ),
  };
}

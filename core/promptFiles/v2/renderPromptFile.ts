import { ContextProviderExtras } from "../..";
import URLContextProvider from "../../context/providers/URLContextProvider";
import { getPreambleAndBody } from "./parse";

async function resolveAttachment(
  name: string,
  extras: ContextProviderExtras,
): Promise<string | null> {
  // Context providers
  const contextProvider = extras.config.contextProviders?.find(
    (provider) => provider.description.title === name,
  );
  if (contextProvider) {
    const items = await contextProvider.getContextItems("", extras);
    return items.map((item) => item.content).join("\n\n");
  }

  // Files
  if (await extras.ide.fileExists(name)) {
    const content = await extras.ide.readFile(name);
    return `\`\`\`${name}\n${content}\n\`\`\``;
  }

  // URLs
  if (name.startsWith("http")) {
    const items = await new URLContextProvider({}).getContextItems(
      name,
      extras,
    );
    return items.map((item) => item.content).join("\n\n");
  }

  return null;
}

export async function renderPromptFileV2(
  rawContent: string,
  extras: ContextProviderExtras,
): Promise<string> {
  const [preamble, body] = getPreambleAndBody(rawContent);

  const attachmentPromises: Promise<string | null>[] = [];
  const renderedBody = body.replace(/@([^\s]+)/g, (match, name) => {
    attachmentPromises.push(resolveAttachment(name, extras));
    return match;
  });
  const attachments = (await Promise.all(attachmentPromises)).filter(Boolean);

  if (!attachments.length) {
    return renderedBody;
  }

  return attachments.join("\n\n") + "\n\n" + renderedBody;
}

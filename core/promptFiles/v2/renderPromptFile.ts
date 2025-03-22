import { ContextItem, ContextProviderExtras } from "../..";
import { contextProviderClassFromName } from "../../context/providers";
import URLContextProvider from "../../context/providers/URLContextProvider";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { getPreambleAndBody } from "./parse";

async function resolveAttachment(
  name: string,
  extras: ContextProviderExtras,
): Promise<ContextItem[]> {
  // Context providers
  const contextProvider = extras.config.contextProviders?.find(
    (provider) => provider.description.title === name,
  );
  if (contextProvider) {
    const items = await contextProvider.getContextItems("", extras);
    return items;
  } else {
    // Just instantiate it here
    const providerClass = contextProviderClassFromName(name) as any;
    if (providerClass) {
      const providerInstance = new providerClass({});
      return providerInstance.getContextItems("", extras);
    }
  }

  // Files
  const resolvedFileUri = await resolveRelativePathInDir(name, extras.ide);
  if (resolvedFileUri) {
    let subItems: ContextItem[] = [];
    if (name.endsWith(".prompt")) {
      // Recurse
      const [items, _] = await renderPromptFileV2(
        await extras.ide.readFile(name),
        extras,
      );
      subItems.push(...items);
    }

    const content = `\`\`\`${name}\n${await extras.ide.readFile(resolvedFileUri)}\n\`\`\``;
    return [
      ...subItems,
      {
        name: getUriPathBasename(resolvedFileUri),
        content,
        description: resolvedFileUri,
      },
    ];
  }

  // URLs
  if (name.startsWith("http")) {
    const items = await new URLContextProvider({}).getContextItems(
      name,
      extras,
    );
    return items;
  }

  return [];
}

export async function renderPromptFileV2(
  rawContent: string,
  extras: ContextProviderExtras,
): Promise<[ContextItem[], string]> {
  const [preamble, body] = getPreambleAndBody(rawContent);

  const contextItemsPromises: Promise<ContextItem[]>[] = [];
  const renderedBody = body.replace(/@([^\s]+)/g, (match, name) => {
    contextItemsPromises.push(resolveAttachment(name, extras));
    return match;
  });

  const contextItems = (await Promise.all(contextItemsPromises)).flat();

  return [contextItems, renderedBody];
}

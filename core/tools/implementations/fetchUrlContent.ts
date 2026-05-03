import { ToolImpl } from ".";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";
import { getStringArg } from "../parseArgs";

const DEFAULT_FETCH_URL_CHAR_LIMIT = 20000;

export const fetchUrlContentImpl: ToolImpl = async (args, extras) => {
  const url = getStringArg(args, "url");
  const prompt =
    typeof args?.prompt === "string" && args.prompt.trim().length > 0
      ? args.prompt.trim()
      : undefined;

  const contextItems = await getUrlContextItems(url, extras.fetch);

  // Track truncated content
  const truncatedUrls: string[] = [];

  // Check and truncate each context item
  const processedItems = contextItems.map((item) => {
    if (item.content.length > DEFAULT_FETCH_URL_CHAR_LIMIT) {
      truncatedUrls.push(url);
      return {
        ...item,
        content: item.content.substring(0, DEFAULT_FETCH_URL_CHAR_LIMIT),
      };
    }
    return item;
  });

  // Add truncation warning if needed
  // Add truncation warning if needed
  if (truncatedUrls.length > 0) {
    processedItems.push({
      name: "Truncation warning",
      description: "",
      content: `The content from ${truncatedUrls.join(", ")} was truncated because it exceeded the ${DEFAULT_FETCH_URL_CHAR_LIMIT} character limit. If you need more content, consider fetching specific sections or using a more targeted approach.`,
    });
  }

  if (!prompt || processedItems.length === 0) {
    return processedItems;
  }

  const sourceContent = processedItems
    .map((item) => `# ${item.name}\n${item.content}`)
    .join("\n\n")
    .slice(0, DEFAULT_FETCH_URL_CHAR_LIMIT);
  const answer = await extras.llm.complete(
    `You are summarizing fetched webpage content for a coding agent. Answer the user's request using only the provided page content. If the answer is not present, say so.\n\nURL: ${url}\n\nUser request: ${prompt}\n\nPage content:\n${sourceContent}`,
    new AbortController().signal,
  );

  return [
    ...processedItems,
    {
      name: "Web page analysis",
      description: prompt,
      content: answer,
    },
  ];
};

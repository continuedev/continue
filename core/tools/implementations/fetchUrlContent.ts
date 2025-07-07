import { ToolImpl } from ".";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";

const DEFAULT_FETCH_URL_CHAR_LIMIT = 20000;

export const fetchUrlContentImpl: ToolImpl = async (args, extras) => {
  const contextItems = await getUrlContextItems(args.url, extras.fetch);

  // Track truncated content
  const truncatedUrls: string[] = [];

  // Check and truncate each context item
  const processedItems = contextItems.map((item) => {
    if (item.content.length > DEFAULT_FETCH_URL_CHAR_LIMIT) {
      truncatedUrls.push(args.url);
      return {
        ...item,
        content: item.content.substring(0, DEFAULT_FETCH_URL_CHAR_LIMIT),
      };
    }
    return item;
  });

  // Add truncation warning if needed
  if (truncatedUrls.length > 0) {
    processedItems.push({
      name: "URL content truncation warning",
      description: "Informs that URL content was truncated",
      content: `The content from ${truncatedUrls.join(", ")} was truncated because it exceeded the ${DEFAULT_FETCH_URL_CHAR_LIMIT} character limit. If you need more content, consider fetching specific sections or using a more targeted approach.`,
    });
  }

  return processedItems;
};

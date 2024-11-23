import { fetchSearchResults } from "../../context/providers/WebContextProvider";

import { ToolImpl } from ".";

export const searchWebImpl: ToolImpl = async (args, extras) => {
  const webResults = await fetchSearchResults(args.query, 5, extras.fetch);
  return webResults;
};

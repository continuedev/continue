import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getStringArg } from "../parseArgs";

const MAX_AGENT_GLOB_RESULTS = 100;

export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  const pattern = getStringArg(args, "pattern");
  const maxResults =
    typeof args?.maxResults === "number" ? args.maxResults : MAX_AGENT_GLOB_RESULTS;
  const results = await extras.ide.getFileResults(
    pattern,
    maxResults,
  );

  if (results.length === 0) {
    return [
      {
        name: "File results",
        description: "glob search",
        content: "The glob search returned no results.",
      },
    ];
  }
  const contextItems: ContextItem[] = [
    {
      name: "File results",
      description: "glob search",
      content: results.join("\n"),
    },
  ];

  // In case of truncation, add a warning
  if (results.length === maxResults) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `Warning: the results above were truncated to the first ${maxResults} files. If the results are not satisfactory, refine your search pattern`,
    });
  }

  return contextItems;
};

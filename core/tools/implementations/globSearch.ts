import { ToolImpl } from ".";
import { ContextItem } from "../..";

const MAX_AGENT_GLOB_RESULTS = 100;
export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  const results = await extras.ide.getFileResults(
    args.pattern,
    MAX_AGENT_GLOB_RESULTS,
  );
  const contextItems: ContextItem[] = [
    {
      name: "File results",
      description: "Results from file glob search",
      content: results.join("\n"),
    },
  ];

  // In case of truncation, add a warning
  if (results.length === MAX_AGENT_GLOB_RESULTS) {
    contextItems.push({
      name: "Truncation warning",
      description: "Inform the model that results were truncated",
      content: `Warning: the results above were truncated to the first ${MAX_AGENT_GLOB_RESULTS} files. If the results are not satisfactory, refine your search pattern`,
    });
  }

  return contextItems;
};

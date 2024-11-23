import { ContextItem, ToolExtras } from "..";
import { BuiltInToolNames } from "./builtIn";
import { createNewFileImpl } from "./implementations/createNewFile";
import { exactSearchImpl } from "./implementations/exactSearch";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";
import { viewRepoMapImpl } from "./implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "./implementations/viewSubdirectory";

async function callToolFromUri(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const canParse = URL.canParse(uri);
  if (!canParse) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const response = await extras.fetch(uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to call tool: ${uri}`);
  }

  const data = await response.json();
  return data.output;
}

export async function callTool(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (uri) {
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args, extras);
    case BuiltInToolNames.ExactSearch:
      return await exactSearchImpl(args, extras);
    case BuiltInToolNames.RunTerminalCommand:
      return await runTerminalCommandImpl(args, extras);
    case BuiltInToolNames.SearchWeb:
      return await searchWebImpl(args, extras);
    case BuiltInToolNames.ViewDiff:
      return await viewDiffImpl(args, extras);
    case BuiltInToolNames.ViewRepoMap:
      return await viewRepoMapImpl(args, extras);
    case BuiltInToolNames.ViewSubdirectory:
      return await viewSubdirectoryImpl(args, extras);
    default:
      return await callToolFromUri(uri, args, extras);
  }
}

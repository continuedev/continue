import { ToolCall } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";

interface FunctionSpecificHeaderProps {
  toolCall: ToolCall;
}

export function FunctionSpecificHeader(props: FunctionSpecificHeaderProps) {
  const [done, incrementalJson] = incrementalParseJson(
    props.toolCall.function.arguments,
  );

  switch (props.toolCall.function.name) {
    case "create_new_file":
      return "Continue wants to create a new file";
    case "run_terminal_command":
      return "Continue wants to run a terminal command.";
    case "exact_search":
      return "Continue wants to search your codebase";
    case "search_web":
      return "Continue wants to search the internet";
    case "view_diff":
      return "Continue wants to view the current git diff";
    case "view_repo_map":
      return "Continue wants to view a map of your repository";
    case "view_subdirectory":
      return `Continue wants to view the contents of ${incrementalJson.directory_path ?? "a subdirectory"}`;
    default:
      return `Continue wants to use the ${props.toolCall.function.name} function.`;
  }
}

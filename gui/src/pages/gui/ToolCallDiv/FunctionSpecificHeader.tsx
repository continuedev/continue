import { ToolCall } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";

interface FunctionSpecificHeaderProps {
  toolCall: ToolCall;
}

export function FunctionSpecificHeader(props: FunctionSpecificHeaderProps) {
  const [done, incrementalJson] = incrementalParseJson(
    props.toolCall.function.arguments,
  );

  let message;

  switch (props.toolCall.function.name) {
    case "create_new_file":
      message = "Continue wants to create a new file";
      break;
    case "run_terminal_command":
      message = "Continue wants to run a terminal command.";
      break;
    case "exact_search":
      message = "Continue wants to search your codebase";
      break;
    case "search_web":
      message = "Continue wants to search the internet";
      break;
    case "view_diff":
      message = "Continue wants to view the current git diff";
      break;
    case "view_repo_map":
      message = "Continue wants to view a map of your repository";
      break;
    case "view_subdirectory":
      message = `Continue wants to view the contents of ${incrementalJson.directory_path ?? "a subdirectory"}`;
      break;
    default:
      message = `Continue wants to use the ${props.toolCall.function.name} function.`;
  }

  return <div>{message}</div>;
}

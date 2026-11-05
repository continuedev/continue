import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import { isNonPublicHostname } from "../../util/networkAddress";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const fetchUrlContentTool: Tool = {
  type: "function",
  displayTitle: "Read URL",
  wouldLikeTo: "fetch {{{ url }}}",
  isCurrently: "fetching {{{ url }}}",
  hasAlready: "fetched {{{ url }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FetchUrlContent,
    description:
      "Can be used to view the contents of a website using a URL. Do NOT use this for files.",
    parameters: {
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          description: "The URL to read",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  // A URL on loopback, a private network or a local name always asks, even
  // when fetching is auto-approved: the model may have been steered there.
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    args: Record<string, unknown>,
  ): ToolPolicy => {
    if (basePolicy === "disabled") return "disabled";
    try {
      const host = new URL(String(args.url)).hostname;
      return isNonPublicHostname(host) ? "allowedWithPermission" : basePolicy;
    } catch {
      return basePolicy;
    }
  },
  systemMessageDescription: {
    prefix: `To fetch the content of a URL, use the ${BuiltInToolNames.FetchUrlContent} tool. For example, to read the contents of a webpage, you might respond with:`,
    exampleArgs: [["url", "https://example.com"]],
  },
  toolCallIcon: "GlobeAltIcon",
};

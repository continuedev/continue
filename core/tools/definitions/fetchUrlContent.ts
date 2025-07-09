import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../systemMessageTools/buildXmlToolsSystemMessage";

export const fetchUrlContentTool: Tool = {
  type: "function",
  displayTitle: "Read URL",
  wouldLikeTo: "fetch {{{ url }}}",
  isCurrently: "fetching {{{ url }}}",
  hasAlready: "viewed {{{ url }}}",
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
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.FetchUrlContent,
    `To fetch the content of a URL, use the ${BuiltInToolNames.FetchUrlContent} tool. For example, to read the contents of a webpage, you might respond with:`,
    `<url>https://example.com</url>`,
  ),
};

import { ToolCallDelta } from "../..";

// export function parseSystemToolCall(toolCallText: string): {
//   delta: ToolCallDelta | undefined;
//   done: boolean;
// } {
//   let done = false;
//   let name = "";
//   const args: Record<string, string> = {};
//   const lines = toolCallText.split("\n");
//   const nameLine = lines[1];

//   for (let i = 0; i < lines.length; i++) {
//     if (i === 0) {
//       continue;
//     }
//     const line = lines[i];
//     if (i === 1) {
//       name = (line.split("TOOL_NAME:")[1] ?? "").trim();
//     } else if (i === 2 && line === "```") {
//       done = true;
//       break;
//     } else {
//       //
//     }
//   }

//   if (done && !name) {
//     throw new Error(
//       "System tool call parsing failed: no name detected\n" + toolCallText,
//     );
//   }

//   if (!name) {
//     return {
//       delta: undefined,
//       done: false,
//     };
//   }

//   return {
//     delta: {
//       type: "function",
//       function: {
//         arguments: JSON.stringify(args),
//         name,
//       },
//       id: "",
//     },
//     done,
//   };
// }

const acceptableToolNameTags = ["tool_name:", "toolname:"];
const acceptableBeginArgTags = ["begin_arg", "beginarg"];
const acceptableEndArgTags = ["end_arg", "endarg"];

export function parseToolCallText(
  text: string,
  toolCallId: string,
): {
  delta: ToolCallDelta | undefined;
  done: boolean;
} {
  let name = "";
  let args: Record<string, any> = {};
  let done = false;
  const lines = text.trim().split("\n");
  let isInArg = false;
  let currentArgName: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerCaseLine = line.toLowerCase();
    const isLastLine = i === lines.length - 1;

    // Skip the ```tool line
    if (i === 0) {
      continue;
    }

    // Special handling for TOOL_NAME line
    if (i === 1) {
      if (acceptableToolNameTags.find((tag) => lowerCaseLine.startsWith(tag)))
        if (
          isLastLine &&
          acceptableToolNameTags.find((tag) => tag.startsWith(lowerCaseLine))
        ) {
          // If it COULD be a tool name tag, break
          break;
        }
      name = (line.split(/tool_?name:/i)[1] ?? "").trim();
    } else if (isInArg) {
      if (acceptableEndArgTags.find((tag) => lowerCaseLine.startsWith(tag))) {
        if (currentArgName) {
          const endValue = args[currentArgName];
          // Case, received back to back BEGIN/END tags -> empty string
          if (!endValue) {
            args[currentArgName] = "";
            // Boolean and number args support
          } else if (endValue.toLowerCase() === "false") {
            args[currentArgName] = false;
          } else if (endValue.toLowerCase() === "true") {
            args[currentArgName] = true;
          } else {
            const num = Number(endValue);
            if (!isNaN(num)) {
              args[currentArgName] = num;
            }
          }
        }
        isInArg = false;
        currentArgName = undefined;
      } else if (
        isLastLine &&
        acceptableEndArgTags.find((tag) => tag.startsWith(lowerCaseLine))
      ) {
        break;
      } else if (currentArgName) {
        if (args[currentArgName]) {
          args[currentArgName] += "\n" + line;
        } else {
          args[currentArgName] = line;
        }
      }
    } else if (
      acceptableBeginArgTags.find((tag) => lowerCaseLine.startsWith(tag))
    ) {
      const argName = (line.split(/begin_?arg:/i)[1] ?? "").trim();
      if (argName) {
        isInArg = true;
        currentArgName = argName;
      }
    } else if (line === "```") {
      done = true;
    } else if (
      isLastLine &&
      ["```", ...acceptableBeginArgTags].some((v) =>
        v.startsWith(lowerCaseLine),
      )
    ) {
      break;
    } else {
      throw new Error("Invalid/hanging line in tool call:\n" + line);
    }
  }

  if (done && !name) {
    throw new Error("Invalid tool name found in call:\n" + text);
  }

  if (!name) {
    return {
      done: false,
      delta: undefined,
    };
  }

  return {
    done,
    delta: {
      type: "function",
      function: {
        arguments: JSON.stringify(args),
        name,
      },
      id: toolCallId,
    },
  };
}

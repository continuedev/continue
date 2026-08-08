import { ToolCallDelta } from "../..";

export function closeTag(openingTag: string): string {
  return `</${openingTag.slice(1)}`;
}

export function splitAtCodeblocksAndNewLines(content: string) {
  return content.split(/(```|\n)/g).filter(Boolean);
}

function randomLettersAndNumbers(length: number): string {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function generateOpenAIToolCallId(): string {
  return `call_${randomLettersAndNumbers(24)}`;
}

export function createDelta(
  name: string,
  args: string,
  id: string,
): ToolCallDelta {
  return {
    type: "function",
    function: {
      name,
      arguments: args,
    },
    id,
  };
}

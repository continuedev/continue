import { ContextItem } from "..";

export const toolErrorContextItem = (
  functionName: string,
  errorMessage: string,
): ContextItem => {
  return {
    icon: "problems",
    name: "Tool Call Error",
    description: "Tool Call Failed",
    content: `${functionName} failed with the message:\n\n${errorMessage}\n\nPlease try something else or request further instructions.`,
    hidden: false,
  };
};

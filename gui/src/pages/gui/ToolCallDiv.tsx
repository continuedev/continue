import { ToolCall } from "core";

interface ToolCallDivProps {
  toolCall: ToolCall;
}
export function ToolCallDiv(props: ToolCallDivProps) {
  return <div>{props.toolCall.function.name}...</div>;
}

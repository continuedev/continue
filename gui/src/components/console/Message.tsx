import {
  AssistantChatMessage,
  ChatMessage,
  ThinkingChatMessage,
  UserChatMessage,
} from "core";
import { memo } from "react";

export interface MessageProps {
  message: ChatMessage;
}

function renderMessageText(text: string) {
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export function renderMessageRole(role: ChatMessage["role"]) {
  return (
    <div>
      <span className="bg-[color:var(--vscode-list-inactiveSelectionBackground)] text-xs">
        {role}
      </span>
    </div>
  );
}

function renderMessageContent(
  message: AssistantChatMessage | UserChatMessage | ThinkingChatMessage,
) {
  if (typeof message.content == "string") {
    return renderMessageText(message.content);
  } else {
    return message.content.map((part) => {
      if (part.type == "text") {
        return renderMessageText(part.text);
      } else {
        return <div>Image: {part.imageUrl.url}</div>;
      }
    });
  }
}

export function renderMessage(message: ChatMessage, includeRole: boolean) {
  switch (message.role) {
    case "assistant":
      return (
        <>
          {includeRole ? renderMessageRole(message.role) : ""}
          {message.toolCalls
            ? message.toolCalls.map((toolCall) => (
                <pre key={toolCall.id}>
                  Tool call: {JSON.stringify(toolCall, undefined, 2)}
                </pre>
              ))
            : ""}
          {renderMessageContent(message)}
        </>
      );
      break;
    case "thinking":
      return (
        <>
          {includeRole ? renderMessageRole(message.role) : ""}
          {message.toolCalls
            ? message.toolCalls.map((toolCall) => (
                <pre>Tool call: {JSON.stringify(toolCall, undefined, 2)}</pre>
              ))
            : ""}
          {renderMessageContent(message)}
          {message.redactedThinking && (
            <pre>Redacted Thinking: {message.redactedThinking}</pre>
          )}
          {message.signature && <pre>Signature: {message.signature}</pre>}
        </>
      );
      break;
    case "user":
      return (
        <>
          {includeRole ? renderMessageRole(message.role) : ""}
          {renderMessageContent(message)}
        </>
      );
      break;
    case "system":
      return (
        <>
          {includeRole ? renderMessageRole(message.role) : ""}
          {renderMessageText(message.content)}
        </>
      );
    case "tool":
      return (
        <>
          {includeRole ? renderMessageRole(message.role) : ""}
          <pre>Tool Call ID: {message.toolCallId}</pre>
          {renderMessageText(message.content)}
        </>
      );
      break;
  }
}

const Message = memo(function Message({ message }: MessageProps) {
  return renderMessage(message, true);
});

export default Message;

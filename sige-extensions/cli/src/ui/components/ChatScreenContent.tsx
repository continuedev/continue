import type { AssistantConfig } from "@continuedev/sdk";
import React from "react";

import type {
  ActivePermissionRequest,
  ActiveQuizQuestion,
} from "../hooks/useChat.types.js";
import { UserInput } from "../UserInput.js";

import { QuizPrompt } from "./QuizPrompt.js";
import { ToolPermissionSelector } from "./ToolPermissionSelector.js";

interface ChatScreenContentProps {
  activePermissionRequest: ActivePermissionRequest | null;
  activeQuizQuestion: ActiveQuizQuestion | null;
  handleToolPermissionResponse: (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean,
    stopStream?: boolean,
  ) => void;
  handleQuizAnswer: (requestId: string, answer: string) => void;
  handleUserMessage: (message: string, imageMap?: Map<string, Buffer>) => void;
  isWaitingForResponse: boolean;
  isCompacting: boolean;
  inputMode: boolean;
  handleInterrupt: () => void;
  assistant?: AssistantConfig;
  wasInterrupted: boolean;
  handleFileAttached: (filePath: string, content: string) => void;
  isInputDisabled: boolean;
  isRemoteMode: boolean;
  onImageInClipboardChange?: (hasImage: boolean) => void;
  onShowEditSelector?: () => void;
}

export const ChatScreenContent: React.FC<ChatScreenContentProps> = ({
  activePermissionRequest,
  activeQuizQuestion,
  handleToolPermissionResponse,
  handleQuizAnswer,
  handleUserMessage,
  isWaitingForResponse,
  isCompacting,
  inputMode,
  handleInterrupt,
  assistant,
  wasInterrupted,
  handleFileAttached,
  isInputDisabled,
  isRemoteMode,
  onImageInClipboardChange,
  onShowEditSelector,
}) => {
  if (activeQuizQuestion) {
    return (
      <QuizPrompt
        question={activeQuizQuestion.question.question}
        options={activeQuizQuestion.question.options}
        defaultAnswer={activeQuizQuestion.question.defaultAnswer}
        requestId={activeQuizQuestion.requestId}
        onAnswer={handleQuizAnswer}
      />
    );
  }

  if (activePermissionRequest) {
    return (
      <ToolPermissionSelector
        toolName={activePermissionRequest.toolName}
        toolArgs={activePermissionRequest.toolArgs}
        requestId={activePermissionRequest.requestId}
        toolCallPreview={activePermissionRequest.toolCallPreview}
        hasDynamicEvaluation={activePermissionRequest.hasDynamicEvaluation}
        onResponse={handleToolPermissionResponse}
      />
    );
  }

  return (
    <UserInput
      onSubmit={handleUserMessage}
      isWaitingForResponse={isWaitingForResponse}
      isCompacting={isCompacting}
      inputMode={inputMode}
      onInterrupt={handleInterrupt}
      assistant={assistant}
      wasInterrupted={wasInterrupted}
      onFileAttached={handleFileAttached}
      disabled={isInputDisabled}
      isRemoteMode={isRemoteMode}
      onImageInClipboardChange={onImageInClipboardChange}
      onShowEditSelector={onShowEditSelector}
    />
  );
};

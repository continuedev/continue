import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import React from "react";

export const DiagnosticMessage: React.FC<{
  type: "warning" | "info" | "error";
  message: string;
}> = ({ type, message }) => {
  const colorVar =
    type === "warning"
      ? "var(--vscode-editorWarning-foreground, #f48771)"
      : type === "info"
        ? "var(--vscode-editorInfo-foreground)"
        : "var(--vscode-editorError-foreground)";
  const Icon =
    type === "warning"
      ? ExclamationTriangleIcon
      : type === "info"
        ? InformationCircleIcon
        : ExclamationCircleIcon;
  return (
    <div className="mt-4 flex items-start space-x-2">
      <Icon
        className="mt-0.5 h-4 w-4"
        style={{ color: colorVar }}
        aria-hidden="true"
      />
      <span className="text-sm">{message}</span>
    </div>
  );
};

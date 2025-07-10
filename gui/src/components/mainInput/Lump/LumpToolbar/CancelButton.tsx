import * as React from "react";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";

interface CancelButtonProps {
  onClick: () => void;
  className?: string;
  showKeyboardShortcut?: boolean;
  children?: React.ReactNode;
}

export function CancelButton({
  onClick,
  showKeyboardShortcut = true,
  children,
}: CancelButtonProps) {
  const jetbrains = isJetBrains();

  return (
    <div
      onClick={onClick}
      className="text-2xs cursor-pointer px-1.5 py-0.5 hover:brightness-125"
    >
      {children || (
        <>
          {showKeyboardShortcut && (
            <span className="text-description-muted mr-1">
              {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()}⌫
            </span>
          )}
          <span className="text-description">Cancel</span>
        </>
      )}
    </div>
  );
}

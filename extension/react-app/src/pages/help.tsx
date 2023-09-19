import React from "react";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import {
  BookOpenIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import KeyboardShortcutsDialog from "../components/dialogs/KeyboardShortcuts";

function HelpPage() {
  return (
    <div>
      <a
        href="https://continue.dev/docs/how-to-use-continue"
        className="no-underline"
      >
        <HeaderButtonWithText text="Docs">
          <BookOpenIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      </a>
      <a
        href="https://github.com/continuedev/continue/issues/new/choose"
        className="no-underline"
      >
        <HeaderButtonWithText text="Feedback">
          <ChatBubbleOvalLeftEllipsisIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      </a>
      <KeyboardShortcutsDialog></KeyboardShortcutsDialog>
    </div>
  );
}

export default HelpPage;

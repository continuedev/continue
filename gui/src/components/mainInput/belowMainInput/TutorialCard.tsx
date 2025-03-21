import {
  ArrowRightStartOnRectangleIcon,
  BookOpenIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";
import Shortcut from "../../gui/Shortcut";

interface TutorialCardProps {
  onClose: () => void;
}

export function TutorialCard({ onClose }: TutorialCardProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const jetbrains = isJetBrains();

  return (
    <div
      className="border-0.5 border-lightGray bg-vsc-background m-1 max-w-96 rounded-md border-solid px-3 py-3 sm:px-5"
      data-testid={`tutorial-card`}
    >
      <div className="flex items-center justify-between">
        <h3 className="m-0 p-0"></h3>
        <div
          onClick={onClose}
          className="cursor-pointer items-center justify-center"
        >
          <XMarkIcon className="h-5 w-5" />
        </div>
      </div>

      <ul className="space-y-4 pl-0" style={{ color: lightGray }}>
        {!jetbrains && (
          <li className="flex items-start">
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 pr-3 align-middle" />
            <span>
              <span
                className="cursor-pointer underline"
                onClick={() =>
                  ideMessenger.post("vscode/openMoveRightMarkdown", undefined)
                }
              >
                Move Chat panel to the right
              </span>{" "}
              for the cleanest experience
            </span>
          </li>
        )}
        <li className="flex items-start">
          <div>
            <PencilSquareIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            Highlight code and press <Shortcut>meta I</Shortcut> to quickly make
            natural language edits
          </span>
        </li>
        <li className="flex items-start">
          <div>
            <ClipboardDocumentIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            Highlight code and press <Shortcut>meta L</Shortcut> to add it to
            the chat window
          </span>
        </li>
        <li className="flex items-start">
          <div>
            <Cog6ToothIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            Click the gear icon in the upper right to configure Continue
          </span>
        </li>
        <li className="flex items-start">
          <div>
            <BookOpenIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            <a
              className="cursor-pointer text-inherit underline hover:text-inherit"
              onClick={() =>
                ideMessenger.post("openUrl", "https://docs.continue.dev")
              }
            >
              Read our documentation
            </a>{" "}
            to learn more
          </span>
        </li>
      </ul>
    </div>
  );
}

import {
  ArrowRightStartOnRectangleIcon,
  BookOpenIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground } from "..";
import { getMetaKeyLabel, isJetBrains } from "../../util";
import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface TutorialCardProps {
  onClose: () => void;
}

const TutorialCardDiv = styled.div`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  background-color: ${vscBackground};
  padding: 1rem 2.5rem 1rem 2rem;
  margin: 1rem;
  max-width: 28rem;
  position: relative;
`;

const CloseButton = styled.button`
  border: none;
  background-color: ${vscBackground};
  color: ${lightGray};
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

export function TutorialCard({ onClose }: TutorialCardProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <TutorialCardDiv>
      <CloseButton onClick={onClose}>
        <XMarkIcon className="h-5 w-5" />
      </CloseButton>

      <ul className="space-y-4 pl-0" style={{ color: lightGray }}>
        {!isJetBrains() && (
          <li className="flex items-start">
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 pr-3 align-middle" />
            <span>
              <span
                className="cursor-pointer underline"
                onClick={() =>
                  ideMessenger.post(
                    "vscode/openMoveRightMarkdown",
                    undefined,
                  )
                }
              >
                Move Chat panel to the right
              </span>{" "}
              for the cleanest experience
            </span>
          </li>
        )}
        <li className="flex items-start">
          <PencilSquareIcon className="h-4 w-4 pr-3 align-middle" />
          <span>
            Highlight code and press <code>{getMetaKeyLabel() + "I"}</code> to
            quickly make natural language edits
          </span>
        </li>
        <li className="flex items-start">
          <ClipboardDocumentIcon className="h-4 w-4 pr-3 align-middle" />
          <span>
            Highlight code and press <code>{getMetaKeyLabel() + "L"}</code> to
            add it to the chat window
          </span>
        </li>
        <li className="flex items-start">
          <Cog6ToothIcon className="h-4 w-4 pr-3 align-middle" />
          <span>
            Click the gear icon in the bottom right to configure Continue
          </span>
        </li>
        <li className="flex items-start">
          <BookOpenIcon className="h-4 w-4 pr-3 align-middle" />
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
    </TutorialCardDiv>
  );
}

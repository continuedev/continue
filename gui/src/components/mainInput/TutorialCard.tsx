import {
  BookOpenIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground } from "..";
import { getMetaKeyLabel } from "../../util";

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
  return (
    <TutorialCardDiv>
      <CloseButton onClick={onClose}>
        <XMarkIcon className="h-5 w-5" />
      </CloseButton>

      <ul className="space-y-4 pl-0" style={{ color: lightGray }}>
        <li className="flex items-start">
          <PencilSquareIcon
            width="1.4em"
            height="1.4em"
            className="align-middle pr-3"
          />
          <span>
            Highlight code and press <code>{getMetaKeyLabel() + "I"}</code> to
            quickly make natural language edits
          </span>
        </li>
        <li className="flex items-start">
          <ClipboardDocumentIcon
            width="1.4em"
            height="1.4em"
            className="align-middle pr-3"
          />
          <span>
            Highlight code and press <code>{getMetaKeyLabel() + "L"}</code> to
            add it to the chat window
          </span>
        </li>
        <li className="flex items-start">
          <Cog6ToothIcon
            width="1.4em"
            height="1.4em"
            className="align-middle pr-3"
          />
          <span>
            Click the gear icon in the bottom right to configure Continue
          </span>
        </li>
        <li className="flex items-start">
          <BookOpenIcon
            width="1.4em"
            height="1.4em"
            className="align-middle pr-3"
          />
          <span>
            <a href="https://docs.continue.dev" target="_blank">
              Read our documentation
            </a>{" "}
            to learn more
          </span>
        </li>
      </ul>
    </TutorialCardDiv>
  );
}

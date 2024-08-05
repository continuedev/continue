import {
  BookOpenIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import styled from "styled-components";
import { defaultBorderRadius, lightGray } from "..";
import { getMetaKeyLabel } from "../../util";

interface TutorialCardProps {
  onClose: () => void;
}

const TutorialCardDiv = styled.div`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 1rem 2.5rem 1rem 2rem;
  margin: 1rem;
  max-width: 28rem;
  position: relative;
`;

export function TutorialCard({ onClose }: TutorialCardProps) {
  return (
    <TutorialCardDiv>
      <div
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 bg-white rounded-full cursor-pointer shadow-sm"
        role="button"
        aria-label="Close"
      >
        <XMarkIcon width="1.2em" height="1.2em" />
      </div>

      <ul className="text-gray-300 space-y-4 pl-0">
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
            Highlight code and press <code>{getMetaKeyLabel() + "L"}</code> o
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

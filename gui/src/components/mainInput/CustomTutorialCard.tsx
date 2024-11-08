import { LightBulbIcon, XMarkIcon } from "@heroicons/react/24/outline";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, lightGray } from "..";
import { CopyButton } from "../markdown/CopyButton";
import { Check, CircleCheck, X, XCircleIcon } from "lucide-react";

interface TutorialCardProps {
  onClose: () => void;
}

export interface TutorialContent {
  goodFor: string;
  notGoodFor: string;
  example: {
    text: string;
    copyText: string;
  };
  moreInfo?: string[];
}

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const CustomTutorialCardDiv = styled.div`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 1rem 2.5rem 1rem 2rem;
  margin: 1rem;
  position: relative;
  animation: ${fadeIn} 0.5s ease-out forwards;
  max-width: 35rem;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const AnimatedListItem = styled.li`
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-out forwards;
  &:nth-child(1) {
    animation-delay: 0.1s;
  }
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.3s;
  }
  &:nth-child(4) {
    animation-delay: 0.4s;
  }
  list-style: none;
`;

function parseInlineCodeBlocks(text) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).trim();
      return <code key={index} className="text-sm p-0.5 ">{code}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

export interface CustomTutorialCardProps extends TutorialCardProps {
  content: TutorialContent;
}

export function CustomTutorialCard({
  onClose,
  content,
}: CustomTutorialCardProps) {
  return (
    <CustomTutorialCardDiv>
      {/* TODO: Uncomment this later. Currently have tutorial card always show. */}
      {/* <div
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 bg-white rounded-full cursor-pointer shadow-sm"
        role="button"
        aria-label="Close"
      >
        <XMarkIcon width="1.2em" height="1.2em" />
      </div> */}

      <ul className="text-foreground space-y-4 pl-0">
        <AnimatedListItem>
          <div className="flex">
            <div className="flex items-center gap-2 min-w-[160px]">
              <Check className="h-4 w-4 text-green-500" />
              <strong>Good for</strong>
            </div>
            <span>{content.goodFor}</span>
          </div>
        </AnimatedListItem>
        <AnimatedListItem>
          <div className="flex">
            <div className="flex items-center gap-2 min-w-[160px]">
              <X className="h-4 w-4 text-red-500" />
              <strong>Less suited for</strong>
            </div>
            <span>{content.notGoodFor}</span>
          </div>
        </AnimatedListItem>
        <AnimatedListItem>
          <div className="flex">
            <div className="flex items-center gap-2 min-w-[160px]">
              <LightBulbIcon className="h-4 w-4 text-yellow-500" />
              <strong>Try yourself</strong>
            </div>
            <span className="flex items-center gap-2">
              {content.example.text}
              <CopyButton text={content.example.copyText} />
            </span>
          </div>
        </AnimatedListItem>
        {content.moreInfo && content.moreInfo.length > 0 && (
          <AnimatedListItem>
            <div className="flex">
              <div className="flex items-center gap-2 min-w-[160px]">
                <LightBulbIcon className="h-4 w-4 text-blue-500" />
                <strong>More information</strong>
              </div>
              <div>
                {content.moreInfo.map((info, index) => (
                  <div key={index}>{parseInlineCodeBlocks(info)}</div>
                ))}
              </div>
            </div>
          </AnimatedListItem>
        )}
      </ul>
    </CustomTutorialCardDiv>
  );
}

import {
  ArrowUturnLeftIcon,
  BarsArrowDownIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  TrashIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscButtonBackground,
  vscInputBackground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import { getFontSize } from "../../util";
import HeaderButtonWithText from "../HeaderButtonWithText";
import { CopyButton } from "../markdown/CopyButton";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";

interface StepContainerProps {
  item: ChatHistoryItem;
  onReverse: () => void;
  onUserInput: (input: string) => void;
  onRetry: () => void;
  onContinueGeneration: () => void;
  onDelete: () => void;
  open: boolean;
  isFirst: boolean;
  isLast: boolean;
  index: number;
  subtext?: string;
}

const ContentDiv = styled.div<{ isUserInput: boolean; fontSize?: number }>`
  padding: 4px 0px 8px 0px;
  background-color: ${(props) =>
    props.isUserInput ? vscInputBackground : vscBackground};
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  // border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

function StepContainer(props: StepContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isUserInput = props.item.message.role === "user";
  const active = useSelector((store: RootState) => store.state.active);
  const ideMessenger = useContext(IdeMessengerContext);

  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);

  const sessionId = useSelector((store: RootState) => store.state.sessionId);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    if (props.item.promptLogs?.length) {
      for (const promptLog of props.item.promptLogs) {
        ideMessenger.post("devdata/log", {
          tableName: "chat",
          data: { ...promptLog, feedback, sessionId },
        });
      }
    }
  };

  const [truncatedEarly, setTruncatedEarly] = useState(false);

  const uiConfig = useUIConfig();

  useEffect(() => {
    if (!active) {
      const content = stripImages(props.item.message.content).trim();
      const endingPunctuation = [".", "?", "!", "```"];

      // If not ending in punctuation or emoji, we assume the response got truncated
      if (
        !(
          endingPunctuation.some((p) => content.endsWith(p)) ||
          /\p{Emoji}/u.test(content.slice(-2))
        )
      ) {
        setTruncatedEarly(true);
      } else {
        setTruncatedEarly(false);
      }
    }
  }, [props.item.message.content, active]);

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <div className="relative">
        <ContentDiv
          hidden={!props.open}
          isUserInput={isUserInput}
          fontSize={getFontSize()}
        >
          {uiConfig?.displayRawMarkdown ? (
            <pre
              className="whitespace-pre-wrap break-words p-4 max-w-full overflow-x-auto"
              style={{ fontSize: getFontSize() - 2 }}
            >
              {stripImages(props.item.message.content)}
            </pre>
          ) : (
            <StyledMarkdownPreview
              source={stripImages(props.item.message.content)}
              showCodeBorder={true}
            />
          )}
        </ContentDiv>
        {(isHovered || typeof feedback !== "undefined") && !active && (
          <div
            className="flex gap-1 absolute -bottom-2 right-0"
            style={{
              zIndex: 200,
              color: lightGray,
              fontSize: getFontSize() - 3,
            }}
          >
            {props.subtext && (
              <div className="flex items-center">
                <CubeIcon className="w-3 h-4 mr-1 flex-shrink-0" />
                {props.subtext}
                <div
                  style={{
                    backgroundColor: vscButtonBackground,
                    borderColor: vscButtonBackground,
                  }}
                  className="w-px h-full ml-3 mr-1"
                />
              </div>
            )}
            {truncatedEarly && (
              <HeaderButtonWithText
                text="Continue generation"
                onClick={(e) => {
                  props.onContinueGeneration();
                }}
              >
                <BarsArrowDownIcon
                  color={lightGray}
                  width="1.2em"
                  height="1.2em"
                />
              </HeaderButtonWithText>
            )}

            <CopyButton
              text={stripImages(props.item.message.content)}
              color={lightGray}
            />
            <HeaderButtonWithText
              text="Regenerate"
              onClick={(e) => {
                props.onRetry();
              }}
            >
              <ArrowUturnLeftIcon
                color={lightGray}
                width="1.2em"
                height="1.2em"
              />
            </HeaderButtonWithText>
            {feedback === false || (
              <HeaderButtonWithText text="Helpful">
                <HandThumbUpIcon
                  className={
                    "cursor-pointer hover:text-green-500" +
                    (feedback === true ? " text-green-500" : "")
                  }
                  width="1.2em"
                  height="1.2em"
                  color={lightGray}
                  onClick={() => {
                    sendFeedback(true);
                  }}
                />
              </HeaderButtonWithText>
            )}
            {feedback === true || (
              <HeaderButtonWithText text="Unhelpful">
                <HandThumbDownIcon
                  className={
                    "cursor-pointer hover:text-red-500" +
                    (feedback === false ? " text-red-500" : "")
                  }
                  width="1.2em"
                  height="1.2em"
                  color={lightGray}
                  onClick={() => {
                    sendFeedback(false);
                  }}
                />
              </HeaderButtonWithText>
            )}
            <HeaderButtonWithText text="Delete Message">
              <TrashIcon
                color={lightGray}
                width="1.2em"
                height="1.2em"
                onClick={() => {
                  props.onDelete();
                }}
              />
            </HeaderButtonWithText>
          </div>
        )}
      </div>
    </div>
  );
}

export default StepContainer;

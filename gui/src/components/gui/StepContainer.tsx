import {
  ArrowLeftEndOnRectangleIcon,
  ArrowUturnLeftIcon,
  BarsArrowDownIcon,
  CubeIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscButtonBackground,
  vscEditorBackground,
  vscInputBackground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import { getAltKeyLabel, getFontSize } from "../../util";
import HeaderButtonWithText from "../HeaderButtonWithText";
import { CopyButton } from "../markdown/CopyButton";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import { isBareChatMode, isPerplexityMode } from "../../util/bareChatMode";

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
  modelTitle?: string;
  source?: "perplexity" | "aider" | "continue";
}

const ContentDiv = styled.div<{ isUserInput: boolean; fontSize?: number }>`
  padding: 4px 0px 8px 0px;
  background-color: ${(props) =>
    props.isUserInput
      ? vscInputBackground
      : window.isPearOverlay
        ? "transparent"
        : vscBackground};
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  // border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

function StepContainer({
  item,
  onReverse,
  onUserInput,
  onRetry,
  onContinueGeneration,
  onDelete,
  open,
  isFirst,
  isLast,
  index,
  modelTitle,
  source = "continue",
}: StepContainerProps) {
  const isUserInput = item.message.role === "user";
  const active =
    source === "continue"
      ? useSelector((store: RootState) => store.state.active)
      : source === "perplexity"
        ? useSelector((store: RootState) => store.state.perplexityActive)
        : useSelector((store: RootState) => store.state.aiderActive);
  const ideMessenger = useContext(IdeMessengerContext);
  const bareChatMode = isBareChatMode();
  const isPerplexity = isPerplexityMode();

  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);

  const sessionId = useSelector((store: RootState) => store.state.sessionId);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    if (item.promptLogs?.length) {
      for (const promptLog of item.promptLogs) {
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
      const content = stripImages(item.message.content).trim();
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
  }, [item.message.content, active]);

  // Add effect to handle keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'l' && isLast && !active && isPerplexity) {
        ideMessenger.post("addPerplexityContext", {
          text: stripImages(item.message.content),
          language: "",
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLast, active, isPerplexity, item.message.content, ideMessenger]);

  return (
    <div>
      <div className="relative">
        <ContentDiv
          hidden={!open}
          isUserInput={isUserInput}
          fontSize={getFontSize()}
        >
          {uiConfig?.displayRawMarkdown ? (
            <pre
              className="whitespace-pre-wrap break-words p-4 max-w-full overflow-x-auto"
              style={{ fontSize: getFontSize() - 2 }}
            >
              {stripImages(item.message.content)}
            </pre>
          ) : (
            <StyledMarkdownPreview
              source={stripImages(item.message.content)}
              showCodeBorder={true}
              isStreaming={active}
              isLast={isLast}
              messageIndex={index}
              integrationSource={source}
            />
          )}
        </ContentDiv>
        {!active && isPerplexity && (
          <HeaderButtonWithText
            onClick={() => {
              ideMessenger.post("addPerplexityContext", {
                text: stripImages(item.message.content),
                language: "",
              });
            }}
          >
            <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
            Add to PearAI chat context {isLast && <span className="ml-1 text-xs opacity-60"><kbd className="font-mono">{getAltKeyLabel()}</kbd> <kbd className="font-mono bg-vscButtonBackground/10 px-1">L</kbd></span>}
          </HeaderButtonWithText>
        )}
        {!active && (
          <div
            className="flex gap-1 absolute -bottom-2 right-0"
            style={{
              zIndex: 200,
              color: lightGray,
              fontSize: getFontSize() - 3,
            }}
          >
            {modelTitle && (
              <div className="flex items-center">
                <CubeIcon className="w-3 h-4 mr-1 flex-shrink-0" />
                {modelTitle}
                <div
                  style={{
                    backgroundColor: vscButtonBackground,
                    borderColor: vscButtonBackground,
                  }}
                  className="w-px h-full ml-3 mr-1"
                />
              </div>
            )}
            {truncatedEarly && !bareChatMode && (
              <HeaderButtonWithText
                text="Continue generation"
                onClick={(e) => {
                  onContinueGeneration();
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
              text={stripImages(item.message.content)}
              color={lightGray}
            />
            {!bareChatMode && (
              <HeaderButtonWithText
                text="Regenerate"
                onClick={(e) => {
                  onRetry();
                }}
              >
                <ArrowUturnLeftIcon
                  color={lightGray}
                  width="1.2em"
                  height="1.2em"
                />
              </HeaderButtonWithText>
            )}
            <HeaderButtonWithText text="Delete Message">
              <TrashIcon
                color={lightGray}
                width="1.2em"
                height="1.2em"
                onClick={() => {
                  onDelete();
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

import {
  ArrowPathIcon,
  BarsArrowDownIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { vscBackground, vscInputBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import { getFontSize } from "../../util";
import ButtonWithTooltip from "../ButtonWithTooltip";
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
  modelTitle?: string;
}

const ContentDiv = styled.div<{ isUserInput: boolean; fontSize?: number }>`
  padding-top: 4px;
  background-color: ${(props) =>
    props.isUserInput ? vscInputBackground : vscBackground};
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  overflow: hidden;
`;

function StepContainer(props: StepContainerProps) {
  const active = useSelector((store: RootState) => store.state.active);
  const [truncatedEarly, setTruncatedEarly] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);
  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);
  const sessionId = useSelector((store: RootState) => store.state.sessionId);

  const isUserInput = props.item.message.role === "user";
  const uiConfig = useUIConfig();
  const shouldRenderActions = !props.isLast || (props.isLast && !active);

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

  return (
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
            showCodeBorder
            source={stripImages(props.item.message.content)}
          />
        )}
      </ContentDiv>

      {shouldRenderActions && (
        <div className="flex items-center justify-end gap-0.5 xs:flex text-xs text-gray-400 p-2 pb-0 cursor-default">
          {truncatedEarly && (
            <ButtonWithTooltip
              tabIndex={-1}
              text="Continue generation"
              onClick={props.onContinueGeneration}
            >
              <BarsArrowDownIcon className="h-3.5 w-3.5 text-gray-500" />
            </ButtonWithTooltip>
          )}

          {props.index !== 1 && (
            <ButtonWithTooltip
              text="Delete"
              tabIndex={-1}
              onClick={props.onDelete}
            >
              <TrashIcon className="h-3.5 w-3.5 text-gray-500" />
            </ButtonWithTooltip>
          )}

          <CopyButton
            tabIndex={-1}
            text={stripImages(props.item.message.content)}
            clipboardIconClassName="h-3.5 w-3.5 text-gray-500"
          />

          <ButtonWithTooltip
            text="Helpful"
            tabIndex={-1}
            onClick={() => sendFeedback(true)}
          >
            <HandThumbUpIcon className="h-3.5 w-3.5 text-gray-500 mx-0.5" />
          </ButtonWithTooltip>

          <ButtonWithTooltip
            text="Unhelpful"
            tabIndex={-1}
            onClick={() => sendFeedback(false)}
          >
            <HandThumbDownIcon className="h-3.5 w-3.5 text-gray-500" />
          </ButtonWithTooltip>
        </div>
      )}
    </div>
  );
}

export default StepContainer;

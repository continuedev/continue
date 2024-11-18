import {
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
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import { CopyIconButton } from "./CopyIconButton";
import HeaderButtonWithToolTip from "./HeaderButtonWithToolTip";

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
  const shouldRenderActions = !active || !props.isLast;

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
    <div
      className="relative"
      style={{
        minHeight: props.isLast ? "50vh" : 0,
      }}
    >
      <ContentDiv
        hidden={!props.open}
        isUserInput={isUserInput}
        fontSize={getFontSize()}
      >
        {uiConfig?.displayRawMarkdown ? (
          <pre
            className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4"
            style={{ fontSize: getFontSize() - 2 }}
          >
            {stripImages(props.item.message.content)}
          </pre>
        ) : (
          <StyledMarkdownPreview
            isRenderingInStepContainer
            source={stripImages(props.item.message.content)}
            contextItems={props.item.contextItems}
          />
        )}
      </ContentDiv>
      <div
        className="xs:flex mx-2 mb-2 flex h-7 cursor-default items-center justify-end gap-0.5 pb-0 text-xs text-gray-400"
        style={{
          opacity: shouldRenderActions ? 1 : 0,
          pointerEvents: shouldRenderActions ? "auto" : "none",
        }}
      >
        {truncatedEarly && (
          <HeaderButtonWithToolTip
            tabIndex={-1}
            text="Continue generation"
            onClick={props.onContinueGeneration}
          >
            <BarsArrowDownIcon className="h-3.5 w-3.5 text-gray-500" />
          </HeaderButtonWithToolTip>
        )}

        {props.index !== 1 && (
          <HeaderButtonWithToolTip
            text="Delete"
            tabIndex={-1}
            onClick={props.onDelete}
          >
            <TrashIcon className="h-3.5 w-3.5 text-gray-500" />
          </HeaderButtonWithToolTip>
        )}

        <CopyIconButton
          tabIndex={-1}
          text={stripImages(props.item.message.content)}
          clipboardIconClassName="h-3.5 w-3.5 text-gray-500"
          checkIconClassName="h-3.5 w-3.5 text-green-400"
        />

        <HeaderButtonWithToolTip
          text="Helpful"
          tabIndex={-1}
          onClick={() => sendFeedback(true)}
        >
          <HandThumbUpIcon
            className={`mx-0.5 h-3.5 w-3.5 ${feedback === true ? "text-green-400" : "text-gray-500"}`}
          />
        </HeaderButtonWithToolTip>

        <HeaderButtonWithToolTip
          text="Unhelpful"
          tabIndex={-1}
          onClick={() => sendFeedback(false)}
        >
          <HandThumbDownIcon
            className={`h-3.5 w-3.5 ${feedback === false ? "text-red-400" : "text-gray-500"}`}
          />
        </HeaderButtonWithToolTip>
      </div>
    </div>
  );
}

export default StepContainer;

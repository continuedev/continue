import { IndexingProgressUpdate } from "core";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { RootState } from "../../redux/store";
import { getFontSize, isJetBrains } from "../../util";
import StatusDot from "./StatusDot";

const STATUS_COLORS = {
  DISABLED: lightGray, // light gray
  LOADING: "#00B8D9", // ice blue
  INDEXING: "#6554C0", // purple
  PAUSED: "#FFAB00", // yellow
  DONE: "#36B37E", // green
  FAILED: "#FF5630", // red
};

const ProgressBarWrapper = styled.div`
  width: 100px;
  height: 6px;
  border-radius: 6px;
  border: 0.5px solid ${lightGray};
`;

const ProgressBarFill = styled.div<{ completed: number; color?: string }>`
  height: 100%;
  background-color: ${(props) => props.color || vscForeground};
  border-radius: inherit;
  transition: width 0.2s ease-in-out;
  width: ${(props) => props.completed}%;
`;

const FlexDiv = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
`;

const StatusHeading = styled.div`
  color: ${lightGray};
  font-size: ${getFontSize() - 2.4}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 400px) {
    display: none;
  }
`;

const StatusInfo = styled.div`
  font-size: ${getFontSize() - 3.6}px;
  color: ${lightGray};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

interface ProgressBarProps {
  indexingState?: IndexingProgressUpdate;
}

const IndexingProgressBar = ({
  indexingState: indexingStateProp,
}: ProgressBarProps) => {
  // If sidebar is opened before extension initiates, define a default indexingState
  const defaultIndexingState: IndexingProgressUpdate = {
    status: "loading",
    progress: 0,
    desc: "",
  };
  const indexingState = indexingStateProp || defaultIndexingState;

  // If sidebar is opened after extension initializes, retrieve saved states.
  let initialized = false;
  useEffect(() => {
    if (!initialized) {
      // Triggers retrieval for possible non-default states set prior to IndexingProgressBar initialization
      ideMessenger.post("index/indexingProgressBarInitialized", undefined);
      initialized = true;
    }
  }, []);

  const fillPercentage = Math.min(
    100,
    Math.max(0, indexingState.progress * 100),
  );

  const ideMessenger = useContext(IdeMessengerContext);

  const embeddingsProvider = useSelector(
    (state: RootState) => state.state.config.embeddingsProvider,
  );

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  const [paused, setPaused] = useState<boolean | undefined>(undefined);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (paused === undefined) return;
    ideMessenger.post("index/setPaused", paused);
  }, [paused]);

  function getIndexingErrMsg(msg: string): string {
    if (
      isJetBrains() &&
      embeddingsProvider === TransformersJsEmbeddingsProvider.model
    ) {
      return "The 'transformers.js' embeddingsProvider is currently unsupported in JetBrains. To enable codebase indexing, you can use any of the other providers described in the docs: https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers";
    }
    return msg;
  }

  return (
    <div
      onClick={() => {
        if (
          indexingState.status !== "failed" &&
          indexingState.progress < 1 &&
          indexingState.progress >= 0
        ) {
          setPaused((prev) => !prev);
        } else {
          ideMessenger.post("index/forceReIndex", undefined);
        }
      }}
      className="cursor-pointer"
    >
      {indexingState.status === "failed" ? (
        <FlexDiv data-tooltip-id="indexingFailed_dot">
          <StatusDot color={STATUS_COLORS.FAILED}></StatusDot>
          <div>
            <StatusHeading>Indexing error - click to retry</StatusHeading>
            {/* <StatusInfo>{getIndexingErrMsg(indexingState.desc)}</StatusInfo> */}
          </div>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingFailed_dot" place="top">
                {getIndexingErrMsg(indexingState.desc)}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : indexingState.status === "loading" ? (
        <FlexDiv>
          <StatusDot shouldBlink color={STATUS_COLORS.LOADING}></StatusDot>
          <StatusHeading>Initializing</StatusHeading>
        </FlexDiv>
      ) : indexingState.status === "done" ? (
        <FlexDiv data-tooltip-id="indexingDone_dot">
          <StatusDot color={STATUS_COLORS.DONE}></StatusDot>
          <div>
            <StatusHeading>Index up to date</StatusHeading>
          </div>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingDone_dot" place="top">
                Index up to date
                <br />
                Click to force re-indexing
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : indexingState.status === "disabled" ? (
        <FlexDiv data-tooltip-id="indexingDisabled_dot">
          <StatusDot color={STATUS_COLORS.DISABLED}></StatusDot>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingDisabled_dot" place="top">
                {indexingState.desc}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : indexingState.status === "paused" ||
        (paused && indexingState.status === "indexing") ? (
        <FlexDiv>
          <StatusDot
            color={STATUS_COLORS.PAUSED}
            onClick={(e) => {
              ideMessenger.post("index/setPaused", false);
            }}
          ></StatusDot>
          <StatusHeading>
            Indexing paused ({Math.trunc(indexingState.progress * 100)}
            %)
          </StatusHeading>
        </FlexDiv>
      ) : indexingState.status === "indexing" ? (
        <FlexDiv
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e) => {
            ideMessenger.post("index/setPaused", true);
          }}
        >
          <StatusDot shouldBlink color={STATUS_COLORS.INDEXING}></StatusDot>
          <div>
            <FlexDiv>
              <ProgressBarWrapper>
                <ProgressBarFill completed={fillPercentage} />
              </ProgressBarWrapper>

              <StatusHeading
                style={{ fontSize: `${getFontSize() - 3}px` }}
              >{`${Math.trunc(indexingState.progress * 100)}%`}</StatusHeading>
            </FlexDiv>

            <StatusInfo>
              {hovered ? "Click to pause" : indexingState.desc}
            </StatusInfo>
          </div>
        </FlexDiv>
      ) : null}
    </div>
  );
};

export default IndexingProgressBar;

import { IndexingProgressUpdate } from "core";
import { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { RootState } from "../../redux/store";
import { getFontSize, isJetBrains } from "../../util";

const DIAMETER = 6;
const CircleDiv = styled.div<{ color: string }>`
  background-color: ${(props) => props.color};
  box-shadow: 0px 0px 2px 1px ${(props) => props.color};
  width: ${DIAMETER}px;
  height: ${DIAMETER}px;
  border-radius: ${DIAMETER / 2}px;
`;

const ProgressBarWrapper = styled.div`
  width: 100px;
  height: 6px;
  border-radius: 6px;
  border: 0.5px solid ${lightGray};
  margin-top: 6px;
`;

const ProgressBarFill = styled.div<{ completed: number; color?: string }>`
  height: 100%;
  background-color: ${(props) => props.color || vscForeground};
  border-radius: inherit;
  transition: width 0.2s ease-in-out;
  width: ${(props) => props.completed}%;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: center;
  justify-items: center;
  margin-left: 8px;
`;

const P = styled.p`
  margin: 0;
  margin-top: 2px;
  font-size: ${getFontSize() - 2.5}px;
  color: ${lightGray};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    if (isJetBrains() && embeddingsProvider === "all-MiniLM-L6-v2") {
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
      {indexingState.status === "failed" ? ( //red 'failed' dot
        <>
          <CircleDiv
            data-tooltip-id="indexingFailed_dot"
            color="#ff0000"
          ></CircleDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingFailed_dot" place="top">
                Error indexing codebase: {getIndexingErrMsg(indexingState.desc)}
                <br />
                Click to retry
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : indexingState.status === "loading" ? ( // ice-blue 'indexing loading' dot
        <>
          <CircleDiv
            data-tooltip-id="indexingNotLoaded_dot"
            color="#72aec2"
          ></CircleDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingNotLoaded_dot" place="top">
                Continue is initializing
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : indexingState.status === "done" ? ( //indexing complete green dot
        <>
          <CircleDiv data-tooltip-id="progress_dot" color="#090"></CircleDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="progress_dot" place="top">
                Index up to date. Click to force re-indexing
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : indexingState.status === "disabled" ? ( //gray disabled dot
        <>
          <CircleDiv
            data-tooltip-id="progress_dot"
            color={lightGray}
          ></CircleDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="progress_dot" place="top">
                {indexingState.desc}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : indexingState.status === "paused" ||
        (paused && indexingState.status === "indexing") ? (
        //yellow 'paused' dot
        <>
          <CircleDiv
            data-tooltip-id="progress_dot"
            color="#bb0"
            onClick={(e) => {
              ideMessenger.post("index/setPaused", false);
            }}
          ></CircleDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="progress_dot" place="top">
                Click to unpause indexing (
                {Math.trunc(indexingState.progress * 100)}%)
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : indexingState.status === "indexing" ? ( //progress bar
        <>
          <GridDiv
            data-tooltip-id="usage_progress_bar"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => {
              ideMessenger.post("index/setPaused", true);
            }}
          >
            <ProgressBarWrapper>
              <ProgressBarFill completed={fillPercentage} />
            </ProgressBarWrapper>
            <P>
              {hovered
                ? "Click to pause"
                : `Indexing (${Math.trunc(indexingState.progress * 100)}%)`}
            </P>
          </GridDiv>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="usage_progress_bar" place="top">
                {indexingState.desc}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </>
      ) : null}
    </div>
  );
};

export default IndexingProgressBar;

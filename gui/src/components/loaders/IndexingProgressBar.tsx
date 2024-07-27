import { IndexingProgressUpdate } from "core";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector, useDispatch } from "react-redux";
import styled, { keyframes } from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { RootState } from "../../redux/store";
import { getFontSize, isJetBrains } from "../../util";
import StatusDot from "./StatusDot";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { usePostHog } from "posthog-js/react";

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
  height: 4px;
  border-radius: 10px;
  background-color: ${vscBackground};
  // border: 1px solid rgba(0, 0, 0, 0.1);
  border: 1px solid #999;
  overflow: hidden;
`;

const shine = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const ProgressBarFill = styled.div<{ completed: number }>`
  height: 100%;
  width: ${(props) => props.completed}%;
  border-radius: inherit;
  background: linear-gradient(to right, #b0d4e3 0%, #4a90e2 50%, #b0d4e3 100%);
  background-size: 200% auto;
  animation: ${shine} 4s infinite linear;
  transition: width 0.5s ease-in-out;
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
  indexingStates?: Map<string, IndexingProgressUpdate>;
  recentIndexingUpdate?: IndexingProgressUpdate;
}

const IndexingProgressBar = ({
  indexingStates: indexingStates,
  recentIndexingUpdate: indexingStateProp,
}: ProgressBarProps) => {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const posthog = usePostHog();

  const [paused, setPaused] = useState<boolean | undefined>(undefined);
  const [hovered, setHovered] = useState(false);

  const embeddingsProvider = useSelector(
    (state: RootState) => state.state.config.embeddingsProvider,
  );

  // If sidebar is opened before extension initiates, define a default indexingState
  const defaultIndexingState: IndexingProgressUpdate = {
    id: "1",
    status: "loading",
    progress: 0,
    desc: "",
  };

  const indexingState = indexingStateProp || defaultIndexingState;

  const fillPercentage = Math.min(
    100,
    Math.max(0, indexingState.progress * 100),
  );

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  // If sidebar is opened after extension initializes, retrieve saved states.
  let initialized = false;

  useEffect(() => {
    if (!initialized) {
      // Triggers retrieval for possible non-default states set prior to IndexingProgressBar initialization
      ideMessenger.post("index/indexingProgressBarInitialized", undefined);
      initialized = true;
    }
  }, []);

  useEffect(() => {
    if (paused === undefined) return;
    ideMessenger.post("index/setPaused", paused);
  }, [paused]);

  function onClick() {
    switch (indexingState.status) {
      case "failed":
        if (indexingState.shouldClearIndexes) {
          dispatch(setShowDialog(true));
          dispatch(
            setDialogMessage(
              <ConfirmationDialog
                title="Rebuild codebase index"
                confirmText="Rebuild"
                text={
                  "Your index appears corrupted. We recommend clearing and rebuilding it, " +
                  "which may take time for large codebases.\n\n" +
                  "Alternatively, you can close this and use the 'Continue: Force Codebase Re-Indexing' " +
                  "command to attempt a faster rebuild without clearing data, though it may be " +
                  "less reliable for persistent issues."
                }
                onConfirm={() => {
                  posthog.capture("rebuild_index_clicked");
                  ideMessenger.post("index/forceReIndex", {
                    shouldClearIndexes: true,
                  });
                }}
              />,
            ),
          );
        } else {
          ideMessenger.post("index/forceReIndex", undefined);
        }

        break;
      case "indexing":
      case "paused":
        if (indexingState.progress < 1 && indexingState.progress >= 0) {
          setPaused((prev) => !prev);
        } else {
          ideMessenger.post("index/forceReIndex", undefined);
        }

        break;
      default:
        ideMessenger.post("index/forceReIndex", undefined);
        break;
    }
  }

  function getIndexingErrMsg(msg: string): string {
    if (
      isJetBrains() &&
      embeddingsProvider === TransformersJsEmbeddingsProvider.model
    ) {
      return (
        "The 'transformers.js' embeddingsProvider is currently unsupported in JetBrains. " +
        "To enable codebase indexing, you can use any of the other providers described " +
        "in the docs: https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers"
      );
    }

    return msg;
  }

  return (
    <div onClick={onClick} className="cursor-pointer">
      {indexingState.status === "failed" ? (
        <FlexDiv data-tooltip-id="indexingFailed_dot">
          <StatusDot color={STATUS_COLORS.FAILED}></StatusDot>
          <div>
            <StatusHeading>Indexing error - click to retry</StatusHeading>
          </div>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingFailed_dot" place="top-start">
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
              <StyledTooltip id="indexingDone_dot" place="top-start">
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
              <StyledTooltip id="indexingDisabled_dot" place="top-start">
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
          <div data-tooltip-id="indexingDetail">
            <FlexDiv>
              <ProgressBarWrapper>
                <ProgressBarFill completed={totalProgress} />
              </ProgressBarWrapper>

              <StatusHeading style={{ fontSize: `${getFontSize() - 3}px` }}>
                {totalProgress}%{" "}
                {indexingStates.size > 1 && `(${indexingStates.size})`}
              </StatusHeading>
            </FlexDiv>

            <StatusInfo>
              {hovered ? "Click to pause" : indexingState.desc}
            </StatusInfo>
          </div>
          {indexingStates.size > 1 &&
            tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip
                id="indexingDetail"
                place="top-start"
                opacity={1.0}
                style={{ textAlign: "left" }}
              >
                {Array.from(indexingStates.values()).map(
                  (indexingUpdate, index) => (
                    <div className="my-1" key={indexingUpdate.id}>
                      <FlexDiv>
                        <ProgressBarWrapper>
                          <ProgressBarFill
                            completed={indexingUpdate.progress * 100}
                          />
                        </ProgressBarWrapper>

                        <StatusHeading
                          style={{ fontSize: `${getFontSize() - 3}px` }}
                        >
                          {`${Math.trunc(indexingUpdate.progress * 100)}%`}
                        </StatusHeading>
                      </FlexDiv>

                      <StatusInfo>{indexingUpdate.desc}</StatusInfo>

                      {index < indexingStates.size - 1 && (
                        <div
                          style={{
                            margin: "4px 0",
                            borderTop: "1px solid rgba(136, 136, 136, 0.3)",
                          }}
                        />
                      )}
                    </div>
                  ),
                )}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : null}
    </div>
  );
};

export default IndexingProgressBar;

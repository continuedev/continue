import { IndexingProgressUpdate } from "core";
import { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { StyledTooltip, lightGray } from "..";
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
  height: 4px;
  border-radius: 10px;
  background-color: #e0e0e0;
  border: 1px solid rgba(0, 0, 0, 0.04);
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

  transition: width 0.5s ease;
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

interface OverallIndexingState {
  progress: number;
  status: IndexingProgressUpdate["status"];
  desc: string;
}

const IndexingProgressBar = ({
  indexingStates,
  recentIndexingUpdate,
}: ProgressBarProps) => {
  // If sidebar is opened before extension initiates, define a default indexingState
  const defaultIndexingState: OverallIndexingState = {
    status: "loading",
    progress: 0,
    desc: "",
  };
  // const indexingState = recentIndexingUpdate || defaultIndexingState;

  // If sidebar is opened after extension initializes, retrieve saved states.
  let initialized = false;
  useEffect(() => {
    if (!initialized) {
      // Triggers retrieval for possible non-default states set prior to IndexingProgressBar initialization
      ideMessenger.post("index/indexingProgressBarInitialized", undefined);
      initialized = true;
    }
  }, []);

  const calculateOverallPercentage = () => {
    let totalProgress = 0;
    let jobCount = 0;

    indexingStates.forEach((indexingProgressUpdate) => {
      if (
        indexingProgressUpdate.status === "loading" ||
        indexingProgressUpdate.status === "indexing"
      ) {
        totalProgress += indexingProgressUpdate.progress;
        jobCount += 1;
      }
    });

    if (jobCount === 0) {
      return 0; // Avoid division by zero, no active indexing tasks
    }

    const overallProgress = totalProgress / jobCount;
    return Math.trunc(overallProgress * 100);
  };

  const calculateOverallStatus = (): IndexingProgressUpdate["status"] => {
    for (const state in indexingStates) {
      console.log("Indexing State: ", state);
    }
    // for (const state in indexingStates) {
    //   if (indexingStates[state] === "failed") {
    //     return "failed";
    //   }
    // }

    return recentIndexingUpdate.status;
  };

  const calculateOverallDesc = (): string => {
    // for (const state in indexingStates) {
    //   if (indexingStates[state].status === "failed") {
    //     return indexingStates[state].desc;
    //   }
    // }

    return recentIndexingUpdate.desc;
  };

  const overallIndexingState = recentIndexingUpdate || defaultIndexingState;

  // const overallIndexingState = recentIndexingUpdate
  //   ? {
  //       progress: calculateOverallPercentage(),
  //       status: calculateOverallStatus(),
  //       desc: recentIndexingUpdate.desc,
  //     }
  //   : defaultIndexingState;

  // const [overallIndexingState, setOverallIndexingState] =
  //   useState<OverallIndexingState>(
  //     recentIndexingUpdate || defaultIndexingState,
  //   );

  // useEffect(() => {
  //   setOverallIndexingState({
  //     progress: calculateOverallPercentage(),
  //     status: recentIndexingUpdate.status,
  //     desc: calculateOverallDesc(),
  //   });
  // }, [recentIndexingUpdate]);

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
          overallIndexingState.status !== "failed" &&
          overallIndexingState.progress < 1 &&
          overallIndexingState.progress >= 0
        ) {
          setPaused((prev) => !prev);
        } else {
          ideMessenger.post("index/forceReIndex", undefined);
        }
      }}
      className="cursor-pointer"
    >
      {overallIndexingState.status === "failed" ? (
        <FlexDiv data-tooltip-id="indexingFailed_dot">
          <StatusDot color={STATUS_COLORS.FAILED}></StatusDot>
          <div>
            <StatusHeading>Indexing error! Click to retry</StatusHeading>
            <StatusInfo>
              {getIndexingErrMsg(overallIndexingState.desc)}
            </StatusInfo>
          </div>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingFailed_dot" place="top">
                {getIndexingErrMsg(overallIndexingState.desc)}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : overallIndexingState.status === "loading" ? (
        <FlexDiv>
          <StatusDot shouldBlink color={STATUS_COLORS.LOADING}></StatusDot>
          <StatusHeading>Continue is initializing</StatusHeading>
        </FlexDiv>
      ) : overallIndexingState.status === "done" ? (
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
      ) : overallIndexingState.status === "disabled" ? (
        <FlexDiv data-tooltip-id="indexingDisabled_dot">
          <StatusDot color={STATUS_COLORS.DISABLED}></StatusDot>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip id="indexingDisabled_dot" place="top">
                {overallIndexingState.desc}
              </StyledTooltip>,
              tooltipPortalDiv,
            )}
        </FlexDiv>
      ) : overallIndexingState.status === "paused" ||
        (paused && overallIndexingState.status === "indexing") ? (
        <FlexDiv>
          <StatusDot
            color={STATUS_COLORS.PAUSED}
            onClick={(e) => {
              ideMessenger.post("index/setPaused", false);
            }}
          ></StatusDot>
          <StatusHeading>
            Indexing paused ({Math.trunc(overallIndexingState.progress * 100)}
            %)
          </StatusHeading>
        </FlexDiv>
      ) : overallIndexingState.status === "indexing" ? (
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
                <ProgressBarFill completed={overallIndexingState.progress} />
              </ProgressBarWrapper>

              <StatusHeading style={{ fontSize: `${getFontSize() - 4}px` }}>
                {overallIndexingState.progress}%
                {indexingStates.size > 0 && ` (${indexingStates.size})`}
              </StatusHeading>
            </FlexDiv>

            <StatusInfo>
              {hovered ? "Click to pause" : overallIndexingState.desc}
            </StatusInfo>
          </div>
          {indexingStates.size > 0 &&
            tooltipPortalDiv &&
            ReactDOM.createPortal(
              <StyledTooltip
                id="indexingDetail"
                place="top"
                style={{ textAlign: "left" }}
              >
                {Array.from(indexingStates.values()).map(
                  (indexingUpdate, index) => (
                    <div className="my-1" key={indexingUpdate.jobId}>
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

                      {index < indexingStates.size - 1 && <hr />}
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

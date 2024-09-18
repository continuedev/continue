import { IndexingProgressUpdate } from "core";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { usePostHog } from "posthog-js/react";
import { useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { Button, lightGray, vscForeground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import { getFontSize, isJetBrains } from "../../util";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import StatusDot from "./StatusDot";

const STATUS_COLORS: Record<IndexingProgressUpdate["status"], string> = {
  disabled: lightGray, // light gray
  loading: "#00B8D9", // ice blue
  indexing: "#6554C0", // purple
  paused: "#FFAB00", // yellow
  done: "#36B37E", // green
  failed: "#FF5630", // red
};

const STATUS_MESSAGES: Record<IndexingProgressUpdate["status"], string> = {
  done: "Indexing complete",
  loading: "Initializing",
  indexing: "Indexing in progress",
  paused: "Indexing paused",
  failed: "Indexing error",
  disabled: "Indexing disabled",
};

const BUTTON_MESSAGES: Record<
  IndexingProgressUpdate["status"],
  string | undefined
> = {
  done: "Re-index",
  loading: undefined,
  indexing: "Pause",
  paused: "Resume",
  failed: "Retry",
  disabled: "Enable",
};

const ProgressBarWrapper = styled.div`
  width: 100%;
  height: 6px;
  border-radius: 6px;
  border: 0.5px solid ${lightGray};

  margin-top: 8px;
  margin-bottom: 8px;
  margin-right: 8px;
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

const StyledButton = styled(Button)`
  padding: 6px 8px;
  border-radius: 3px;
`;

interface ProgressBarProps {
  indexingState?: IndexingProgressUpdate;
}

const IndexingProgressBar = ({
  indexingState: indexingStateProp,
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
    <div>
      <i
        style={{
          color: lightGray,
          fontSize: getFontSize() - 2,
        }}
      >
        Indexing generates embeddings used for codebase retrieval. The index is
        stored entirely locally.
      </i>

      <ProgressBarWrapper>
        <ProgressBarFill completed={fillPercentage} />
      </ProgressBarWrapper>

      <div className="flex justify-between">
        <FlexDiv data-tooltip-id="indexingDone_dot">
          <StatusDot color={STATUS_COLORS[indexingState.status]}></StatusDot>
          <div>
            <StatusHeading>
              {STATUS_MESSAGES[indexingState.status]}
            </StatusHeading>
          </div>
        </FlexDiv>
        <p
          style={{
            color: lightGray,
            fontSize: getFontSize() - 2,
            margin: 0,
          }}
        >
          {Math.trunc(Math.min(100, 100 * indexingState.progress))}%
        </p>
      </div>

      {indexingState.status === "disabled" ? null : indexingState.status ===
        "done" ? (
        <StyledButton
          onClick={() => {
            ideMessenger.post("index/forceReIndex", undefined);
          }}
        >
          Re-index
        </StyledButton>
      ) : indexingState.status === "failed" ? (
        <StyledButton
          onClick={() => {
            // For now, we don't show in JetBrains since the reindex command
            // is not yet implemented
            if (indexingState.shouldClearIndexes && !isJetBrains()) {
              dispatch(setShowDialog(true));
              dispatch(
                setDialogMessage(
                  <ConfirmationDialog
                    title="Rebuild codebase index"
                    confirmText="Rebuild"
                    text={
                      "Your index appears corrupted. We recommend clearing and rebuilding it, " +
                      "which may take time for large codebases.\n\n" +
                      "For a faster rebuild without clearing data, press 'Shift + Command + P' to open " +
                      "the Command Palette, and type out 'Continue: Force Codebase Re-Indexing'"
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
          }}
        >
          Retry
        </StyledButton>
      ) : indexingState.status === "indexing" ||
        indexingState.status === "loading" ? (
        <div>
          <StyledButton
            onClick={() => {
              if (indexingState.progress < 1 && indexingState.progress >= 0) {
                setPaused((prev) => !prev);
              } else {
                ideMessenger.post("index/forceReIndex", undefined);
              }
            }}
          >
            Pause
          </StyledButton>
        </div>
      ) : indexingState.status === "paused" ? (
        <StyledButton
          onClick={() => {
            if (indexingState.progress < 1 && indexingState.progress >= 0) {
              setPaused((prev) => !prev);
            } else {
              ideMessenger.post("index/forceReIndex", undefined);
            }
          }}
        >
          Resume
        </StyledButton>
      ) : null}

      <div style={{ height: "40px", overflow: "hidden" }}>
        {indexingState.status === "failed" && (
          <p style={{ color: "red", fontSize: getFontSize() - 2 }}>
            {getIndexingErrMsg(indexingState.desc)}
          </p>
        )}
        {indexingState.status === "indexing" && (
          <p style={{ color: lightGray }}>{indexingState.desc}</p>
        )}
      </div>
    </div>
  );
};

export default IndexingProgressBar;

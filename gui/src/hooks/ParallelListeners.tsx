import { useCallback, useContext, useEffect, useRef } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { FromCoreProtocol } from "core/protocol";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfigLoading, setConfigResult } from "../redux/slices/configSlice";
import {
  setLastNonEditSessionEmpty,
  updateEditStateApplyState,
} from "../redux/slices/editState";
import { updateIndexingStatus } from "../redux/slices/indexingSlice";
import {
  initializeProfilePreferences,
  setOrganizations,
  setSelectedOrgId,
  setSelectedProfile,
} from "../redux/slices/profilesSlice";
import {
  acceptToolCall,
  addContextItemsAtIndex,
  setHasReasoningEnabled,
  setIsSessionMetadataLoading,
  updateApplyState,
  updateToolCallOutput,
} from "../redux/slices/sessionSlice";
import { setTTSActive } from "../redux/slices/uiSlice";
import { exitEdit } from "../redux/thunks/edit";
import { streamResponseAfterToolCall } from "../redux/thunks/streamResponseAfterToolCall";

import { store } from "../redux/store";
import { cancelStream } from "../redux/thunks/cancelStream";
import { refreshSessionMetadata } from "../redux/thunks/session";
import { updateFileSymbolsFromHistory } from "../redux/thunks/updateFileSymbols";
import { findToolCallById, logToolUsage } from "../redux/util";
import {
  setDocumentStylesFromLocalStorage,
  setDocumentStylesFromTheme,
} from "../styles/theme";
import { isJetBrains } from "../util";
import { setLocalStorage } from "../util/localStorage";
import { migrateLocalStorage } from "../util/migrateLocalStorage";
import { useWebviewListener } from "./useWebviewListener";

function ParallelListeners() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((store) => store.session.history);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const selectedProfileId = useAppSelector(
    (store) => store.profiles.selectedProfileId,
  );
  const hasDoneInitialConfigLoad = useRef(false);
  const autoAcceptEditToolDiffs = useAppSelector(
    (store) => store.config.config.ui?.autoAcceptEditToolDiffs,
  );
  // Load symbols for chat on any session change
  const sessionId = useAppSelector((state) => state.session.id);

  const handleConfigUpdate = useCallback(
    async (isInitial: boolean, result: FromCoreProtocol["configUpdate"][0]) => {
      const {
        result: configResult,
        profileId,
        organizations,
        selectedOrgId,
      } = result;
      if (isInitial && hasDoneInitialConfigLoad.current) {
        return;
      }
      hasDoneInitialConfigLoad.current = true;
      dispatch(setOrganizations(organizations));
      dispatch(setSelectedOrgId(selectedOrgId));
      dispatch(setSelectedProfile(profileId));
      dispatch(setConfigResult(configResult));

      const isNewProfileId = profileId && profileId !== selectedProfileId;

      if (isNewProfileId) {
        dispatch(
          initializeProfilePreferences({
            defaultSlashCommands: [],
            profileId,
          }),
        );
      }

      // Perform any actions needed with the config
      if (configResult.config?.ui?.fontSize) {
        setLocalStorage("fontSize", configResult.config.ui.fontSize);
        document.body.style.fontSize = `${configResult.config.ui.fontSize}px`;
      }

      if (
        configResult.config?.selectedModelByRole.chat?.completionOptions
          ?.reasoning
      ) {
        dispatch(setHasReasoningEnabled(true));
      }
    },
    [dispatch, hasDoneInitialConfigLoad],
  );

  // Load config from the IDE
  useEffect(() => {
    async function initialLoadConfig() {
      dispatch(setIsSessionMetadataLoading(true));
      dispatch(setConfigLoading(true));
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "success") {
        await handleConfigUpdate(true, result.content);
      }
      dispatch(setConfigLoading(false));
    }
    void initialLoadConfig();
    const interval = setInterval(() => {
      if (hasDoneInitialConfigLoad.current) {
        // Init to run on initial config load
        ideMessenger.post("docs/initStatuses", undefined);
        void dispatch(updateFileSymbolsFromHistory());
        void dispatch(refreshSessionMetadata({}));

        // This triggers sending pending status to the GUI for relevant docs indexes
        clearInterval(interval);
      } else {
        void initialLoadConfig();
      }
    }, 2_000);

    return () => clearInterval(interval);
  }, [hasDoneInitialConfigLoad, ideMessenger]);

  useWebviewListener(
    "configUpdate",
    async (update) => {
      if (!update) {
        return;
      }
      await handleConfigUpdate(false, update);
    },
    [handleConfigUpdate],
  );

  useEffect(() => {
    if (sessionId) {
      void dispatch(updateFileSymbolsFromHistory());
    }
  }, [sessionId]);

  // ON LOAD
  useEffect(() => {
    // Override persisted state
    void dispatch(cancelStream());

    const jetbrains = isJetBrains();
    setDocumentStylesFromLocalStorage(jetbrains);

    if (jetbrains) {
      // Save theme colors to local storage for immediate loading in JetBrains
      void ideMessenger
        .request("jetbrains/getColors", undefined)
        .then((result) => {
          if (result.status === "success") {
            setDocumentStylesFromTheme(result.content);
          }
        });

      // Tell JetBrains the webview is ready
      void ideMessenger
        .request("jetbrains/onLoad", undefined)
        .then((result) => {
          if (result.status === "error") {
            return;
          }

          const msg = result.content;
          (window as any).windowId = msg.windowId;
          (window as any).serverUrl = msg.serverUrl;
          (window as any).workspacePaths = msg.workspacePaths;
          (window as any).vscMachineId = msg.vscMachineId;
          (window as any).vscMediaUrl = msg.vscMediaUrl;
        });
    }
  }, []);

  useWebviewListener(
    "jetbrains/setColors",
    async (data) => {
      setDocumentStylesFromTheme(data);
    },
    [],
  );

  // IDE event listeners
  useWebviewListener(
    "getWebviewHistoryLength",
    async () => {
      return history.length;
    },
    [history],
  );

  useWebviewListener(
    "getCurrentSessionId",
    async () => {
      return sessionId;
    },
    [sessionId],
  );

  useWebviewListener("setInactive", async () => {
    void dispatch(cancelStream());
  });

  useWebviewListener("setTTSActive", async (status) => {
    dispatch(setTTSActive(status));
  });

  useWebviewListener("addContextItem", async (data) => {
    dispatch(
      addContextItemsAtIndex({
        index: data.historyIndex,
        contextItems: [data.item],
      }),
    );
  });

  useWebviewListener("indexing/statusUpdate", async (data) => {
    dispatch(updateIndexingStatus(data));
  });

  // Track processed toolCallIds to prevent duplicates
  const processedToolCalls = useRef(new Set<string>());

  useWebviewListener(
    "updateApplyState",
    async (state) => {
      if (state.streamId === EDIT_MODE_STREAM_ID) {
        dispatch(updateEditStateApplyState(state));

        if (state.status === "closed") {
          const toolCallState = findToolCallById(
            store.getState().session.history,
            state.toolCallId!,
          );
          if (toolCallState) {
            logToolUsage(toolCallState, true, true, ideMessenger);
          }
          void dispatch(exitEdit({}));
        }
      } else {
        // chat or agent
        dispatch(updateApplyState(state));

        // Handle apply status updates - use toolCallId from event payload
        if (state.toolCallId) {
          if (state.status === "done" && autoAcceptEditToolDiffs) {
            ideMessenger.post("acceptDiff", {
              streamId: state.streamId,
              filepath: state.filepath,
            });
          }
          if (state.status === "closed") {
            // Check if we've already processed this toolCallId
            if (processedToolCalls.current.has(state.toolCallId)) {
              return;
            }

            // Find the tool call to check if it was canceled
            const toolCallState = findToolCallById(
              store.getState().session.history,
              state.toolCallId,
            );

            // Only process closed events that have actual diff resolution data (not undefined)
            const hasValidDiffData =
              state.acceptedDiffs !== undefined &&
              state.rejectedDiffs !== undefined;

            if (
              toolCallState &&
              toolCallState.status !== "canceled" &&
              toolCallState.status !== "errored" &&
              hasValidDiffData
            ) {
              // Mark this toolCallId as processed
              processedToolCalls.current.add(state.toolCallId);
              // Use 3-state feedback based on acceptance/rejection counts
              const totalDiffs =
                (state.acceptedDiffs || 0) + (state.rejectedDiffs || 0);
              let feedbackMessage: string;

              let finalOutput;

              if (state.rejectedDiffs === totalDiffs && totalDiffs > 0) {
                // All diffs were rejected - provide explicit stop instruction
                feedbackMessage =
                  "The search and replace tool executed successfully, but the user rejected ALL proposed changes. This means:\n\n1. DO NOT attempt any more file modifications\n2. DO NOT try different changes\n3. STOP and ask the user for clarification\n\nYou must now ask the user: 'I see you rejected all my proposed changes. Could you help me understand what you're looking for instead? What specific changes would you like me to make to the file?'";
                finalOutput = {
                  name: "Search and Replace Tool - User Rejected All Changes",
                  description:
                    "Tool succeeded but user rejected all changes - LLM must stop and consult user",
                  content: feedbackMessage,
                  status: "user_rejected_all",
                };
                dispatch(
                  acceptToolCall({
                    toolCallId: state.toolCallId,
                  }),
                );
              } else if (state.acceptedDiffs === totalDiffs && totalDiffs > 0) {
                // All diffs were accepted
                feedbackMessage = "User accepted all proposed changes";
                finalOutput = {
                  name: "Search and Replace Result",
                  description: `All proposed changes to ${state.filepath} were accepted by the user`,
                  content: feedbackMessage,
                  status: "accepted",
                };
                dispatch(
                  acceptToolCall({
                    toolCallId: state.toolCallId,
                  }),
                );
              } else if (totalDiffs > 0) {
                // Partial acceptance - stop and ask user what to do next
                feedbackMessage = `User partially accepted changes (${state.acceptedDiffs}/${totalDiffs} accepted, ${state.rejectedDiffs}/${totalDiffs} rejected). Some of your proposed changes were accepted while others were rejected.\n\nPlease ask the user what they would like to do next. For example:\n- Do they want you to try different approaches for the rejected changes?\n- Are they satisfied with the current state?\n- Do they have specific feedback about what they want instead?`;
                finalOutput = {
                  name: "Search and Replace Result - Partial Acceptance",
                  description: `Partial acceptance of changes to ${state.filepath} - LLM should ask user for next steps`,
                  content: feedbackMessage,
                  status: "partial",
                };
                dispatch(
                  acceptToolCall({
                    toolCallId: state.toolCallId,
                  }),
                );
              } else {
                // No diffs were processed (shouldn't happen, but handle gracefully)
                feedbackMessage = "File changes were applied successfully";
                finalOutput = {
                  name: "Search and Replace Result",
                  description: "Changes were applied successfully",
                  content: feedbackMessage,
                  status: "success",
                };
                dispatch(
                  acceptToolCall({
                    toolCallId: state.toolCallId,
                  }),
                );
              }

              // Replace the entire output rather than appending to avoid confusion
              dispatch(
                updateToolCallOutput({
                  toolCallId: state.toolCallId,
                  contextItems: [finalOutput],
                }),
              );

              // Always trigger the response continuation
              void dispatch(
                streamResponseAfterToolCall({
                  toolCallId: state.toolCallId,
                }),
              );
            }
          }
        }
      }
    },
    [autoAcceptEditToolDiffs, ideMessenger],
  );

  useEffect(() => {
    if (!isInEdit) {
      dispatch(setLastNonEditSessionEmpty(history.length === 0));
    }
  }, [isInEdit, history]);

  useEffect(() => {
    migrateLocalStorage(dispatch);
  }, []);

  return <></>;
}

export default ParallelListeners;

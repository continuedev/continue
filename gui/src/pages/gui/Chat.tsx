import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
} from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/react";
import { ChatHistoryItem, InputModifiers } from "core";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import styled from "styled-components";
import { Button, lightGray, vscBackground } from "../../components";
import { AssistantAndOrgListbox } from "../../components/AssistantAndOrgListbox";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import { NewSessionButton } from "../../components/mainInput/belowMainInput/NewSessionButton";
import ThinkingBlockPeek from "../../components/mainInput/belowMainInput/ThinkingBlockPeek";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { useOnboardingCard } from "../../components/OnboardingCard";
import StepContainer from "../../components/StepContainer";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectDoneApplyStates,
  selectPendingToolCalls,
  selectVisibleApplyStates,
} from "../../redux/selectors/selectToolCalls";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";
import {
  cancelToolCall,
  ChatHistoryItemWithMessageId,
  newSession,
  setActiveAgentSessionId,
  updateToolCallOutput,
} from "../../redux/slices/sessionSlice";
import { streamEditThunk } from "../../redux/thunks/edit";
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../util";
import { ToolCallDiv } from "./ToolCallDiv";

import { useStore } from "react-redux";
import { AgentsList } from "../../components/BackgroundMode/AgentsList";
import { BackgroundModeView } from "../../components/BackgroundMode/BackgroundModeView";
import { CliInstallBanner } from "../../components/CliInstallBanner";
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";

import { AgentChatView } from "../../components/Agent/AgentChatView";
import { FatalErrorIndicator } from "../../components/config/FatalErrorNotice";
import InlineErrorMessage from "../../components/mainInput/InlineErrorMessage";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { RootState } from "../../redux/store";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { EmptyChatBody } from "./EmptyChatBody";
import { ExploreDialogWatcher } from "./ExploreDialogWatcher";
import { TeamCoordinationPanel } from "./TeamCoordinationPanel";
import { ModifiedFilesMenu } from "./ToolCallDiv/ModifiedFilesMenu";
import {
  findLatestTodoToolCallStateInCurrentTurn,
  TodoListMenu,
} from "./ToolCallDiv/TodoListMenu";
import { useAutoScroll } from "./useAutoScroll";
import { WorkingGroupBox } from "./WorkingGroupBox";

// Helper function to find the index of the latest conversation summary
function findLatestSummaryIndex(history: ChatHistoryItem[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].conversationSummary) {
      return i;
    }
  }
  return -1; // No summary found
}

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  .thread-message {
    margin: 0 0 0 1px;
  }
`;

export const MAIN_EDITOR_INPUT_ID = "main-editor-input";

function fallbackRender({ error, resetErrorBoundary }: any) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div
      role="alert"
      className="px-2"
      style={{ backgroundColor: vscBackground }}
    >
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
      <pre style={{ color: lightGray }}>{error.stack}</pre>

      <div className="text-center">
        <Button onClick={resetErrorBoundary}>Restart</Button>
      </div>
    </div>
  );
}

export function Chat() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const reduxStore = useStore<RootState>();
  const onboardingCard = useOnboardingCard();
  const showSessionTabs = useAppSelector(
    (store) => store.config.config.ui?.showSessionTabs,
  );
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen] = useState<(boolean | undefined)[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const history = useAppSelector((state) => state.session.history);
  const visibleApplyStates = useAppSelector(selectVisibleApplyStates);
  const latestTodoToolCallState = useMemo(
    () => findLatestTodoToolCallStateInCurrentTurn(history),
    [history],
  );
  const showChatScrollbar = useAppSelector(
    (state) => state.config.config.ui?.showChatScrollbar,
  );
  const codeToEdit = useAppSelector((state) => state.editModeState.codeToEdit);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);

  const lastSessionId = useAppSelector((state) => state.session.lastSessionId);
  const allSessionMetadata = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );
  const hasDismissedExploreDialog = useAppSelector(
    (state) => state.ui.hasDismissedExploreDialog,
  );
  const mode = useAppSelector((state) => state.session.mode);
  const agentSessionId = useAppSelector(
    (state) => state.session.activeAgentSessionId,
  );
  const currentOrg = useAppSelector(selectCurrentOrg);
  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);

  useAutoScroll(stepsDivRef, history);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === "Backspace" &&
        (jetbrains ? e.altKey : isMetaEquivalentKeyPressed(e)) &&
        !e.shiftKey
      ) {
        void dispatch(cancelStream());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [isStreaming, jetbrains, isInEdit]);

  const { widget, highlights } = useFindWidget(
    stepsDivRef,
    tabsRef,
    isStreaming,
  );

  useEffect(() => {
    if (isStreaming || agentSessionId) {
      setIsSubmittingInput(false);
    }
  }, [isStreaming, agentSessionId]);

  const sendInput = useCallback(
    (
      editorState: JSONContent,
      modifiers: InputModifiers,
      index?: number,
      editorToClearOnSend?: Editor,
    ) => {
      const stateSnapshot = reduxStore.getState();
      const latestPendingToolCalls = selectPendingToolCalls(stateSnapshot);
      const latestPendingApplyStates = selectDoneApplyStates(stateSnapshot);
      const isCurrentlyInEdit = stateSnapshot.session.isInEdit;
      const codeToEditSnapshot = stateSnapshot.editModeState.codeToEdit;
      const selectedModelByRole =
        stateSnapshot.config.config.selectedModelByRole;
      const currentMode = stateSnapshot.session.mode;
      const isMainInputSubmit = !!editorToClearOnSend;

      const stopSubmittingIndicator = () => {
        if (isMainInputSubmit) {
          setIsSubmittingInput(false);
        }
      };

      if (isMainInputSubmit) {
        setIsSubmittingInput(true);
      }

      // Handle Yuto agent mode: fire agent/run and show the AgentChatView
      if (currentMode === "agent" && !isCurrentlyInEdit) {
        const defaultContextProviders =
          stateSnapshot.config.config.experimental?.defaultContext ?? [];
        const AGENT_SUBMIT_TIMEOUT_MS = 8_000;

        void (async () => {
          const fallbackToStandardStreaming = () => {
            void dispatch(
              streamResponseThunk({ editorState, modifiers, index }),
            );
            if (editorToClearOnSend) {
              editorToClearOnSend.commands.clearContent();
            }
            stopSubmittingIndicator();
          };

          const withTimeout = async <T,>(
            promise: Promise<T>,
            timeoutMs: number,
            label: string,
          ): Promise<T> => {
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            try {
              return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                  timeoutId = setTimeout(() => {
                    reject(
                      new Error(
                        `Timed out after ${timeoutMs}ms while waiting for ${label}`,
                      ),
                    );
                  }, timeoutMs);
                }),
              ]);
            } finally {
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            }
          };

          try {
            const { content } = await withTimeout(
              resolveEditorContent({
                editorState,
                modifiers,
                ideMessenger,
                defaultContextProviders,
                availableSlashCommands:
                  stateSnapshot.config.config.slashCommands,
                dispatch,
                getState: () => reduxStore.getState(),
              }),
              AGENT_SUBMIT_TIMEOUT_MS,
              "context resolution",
            );

            const promptText = stripImages(content);
            if (!promptText.trim()) {
              console.error(
                "[Yuto] agent/run skipped because resolved prompt was empty; falling back to chat streaming",
              );
              fallbackToStandardStreaming();
              return;
            }

            const res = await withTimeout(
              ideMessenger.request("agent/run", {
                prompt: promptText,
              }),
              AGENT_SUBMIT_TIMEOUT_MS,
              "agent/run",
            );

            if (res.status === "success" && res.content?.sessionId) {
              dispatch(setActiveAgentSessionId(res.content.sessionId));
              if (editorToClearOnSend) {
                editorToClearOnSend.commands.clearContent();
              }
              stopSubmittingIndicator();
            } else {
              if (res.status === "success") {
                console.error(
                  "[Yuto] agent/run returned success without sessionId",
                );
              } else {
                console.error(
                  "[Yuto] agent/run returned error status:",
                  res.error,
                );
              }
              // Fall back to normal chat streaming instead of silently dropping submit.
              fallbackToStandardStreaming();
            }
          } catch (err) {
            console.error("[Yuto] agent mode submit failed:", err);
            // Any failure in agent-mode submit path should degrade gracefully to normal chat.
            fallbackToStandardStreaming();
          }
        })();
        return;
      }

      // Handle background mode specially
      if (currentMode === "background" && !isCurrentlyInEdit) {
        // Background mode triggers agent creation instead of chat
        const currentOrg = selectCurrentOrg(stateSnapshot);
        const organizationId =
          currentOrg?.id !== "personal" ? currentOrg?.id : undefined;

        setIsCreatingAgent(true);

        // Create agent and track loading state
        void (async () => {
          try {
            // Resolve context items from editor content (same as normal chat)
            const defaultContextProviders =
              stateSnapshot.config.config.experimental?.defaultContext ?? [];

            const { selectedContextItems, selectedCode, content } =
              await resolveEditorContent({
                editorState,
                modifiers,
                ideMessenger,
                defaultContextProviders,
                availableSlashCommands:
                  stateSnapshot.config.config.slashCommands,
                dispatch,
                getState: () => reduxStore.getState(),
              });

            await ideMessenger.request("createBackgroundAgent", {
              content,
              contextItems: selectedContextItems,
              selectedCode,
              organizationId,
            });

            // Clear input only after successful API call
            if (editorToClearOnSend) {
              editorToClearOnSend.commands.clearContent();
            }
          } catch (error) {
            console.error("Failed to create background agent:", error);
          } finally {
            setIsCreatingAgent(false);
            stopSubmittingIndicator();
          }
        })();

        return;
      }

      // Cancel all pending tool calls
      latestPendingToolCalls.forEach((toolCallState) => {
        dispatch(
          cancelToolCall({
            toolCallId: toolCallState.toolCallId,
          }),
        );
      });

      // Reject all pending apply states
      latestPendingApplyStates.forEach((applyState) => {
        if (applyState.status !== "closed") {
          ideMessenger.post("rejectDiff", applyState);
        }
      });
      const model = isCurrentlyInEdit
        ? (selectedModelByRole.edit ?? selectedModelByRole.chat)
        : selectedModelByRole.chat;

      if (!model) {
        stopSubmittingIndicator();
        return;
      }

      if (isCurrentlyInEdit && codeToEditSnapshot.length === 0) {
        stopSubmittingIndicator();
        return;
      }

      if (isCurrentlyInEdit) {
        void dispatch(
          streamEditThunk({
            editorState,
            codeToEdit: codeToEditSnapshot,
          }),
        );
        stopSubmittingIndicator();
      } else {
        void dispatch(streamResponseThunk({ editorState, modifiers, index }));

        if (editorToClearOnSend) {
          editorToClearOnSend.commands.clearContent();
        }
        stopSubmittingIndicator();
      }

      // Increment localstorage counter for popup
      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
        if (currentCount === 300) {
          dispatch(setDialogMessage(<FeedbackDialog />));
          dispatch(setShowDialog(true));
        }
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [
      dispatch,
      ideMessenger,
      reduxStore,
      setIsCreatingAgent,
      setIsSubmittingInput,
    ],
  );

  useWebviewListener(
    "newSession",
    async () => {
      // unwrapResult(response) // errors if session creation failed
      mainTextInputRef.current?.focus?.();
    },
    [mainTextInputRef],
  );

  // Handle partial tool call output for streaming updates
  useWebviewListener(
    "toolCallPartialOutput",
    async (data) => {
      // Update tool call output in Redux store
      dispatch(
        updateToolCallOutput({
          toolCallId: data.toolCallId,
          contextItems: data.contextItems,
        }),
      );
    },
    [dispatch],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      return !history
        .slice(index + 1)
        .some((entry) => entry.message.role === "user");
    },
    [history],
  );

  const renderChatHistoryItem = useCallback(
    (item: ChatHistoryItemWithMessageId, index: number) => {
      const {
        message,
        editorState,
        contextItems,
        appliedRules,
        toolCallStates,
      } = item;

      // Calculate once for the entire function
      const latestSummaryIndex = findLatestSummaryIndex(history);
      const isBeforeLatestSummary =
        latestSummaryIndex !== -1 && index < latestSummaryIndex;

      if (message.role === "user") {
        return (
          <ContinueInputBox
            onEnter={(editorState, modifiers) =>
              sendInput(editorState, modifiers, index)
            }
            isLastUserInput={isLastUserInput(index)}
            isMainInput={false}
            editorState={editorState ?? item.message.content}
            contextItems={contextItems}
            appliedRules={appliedRules}
            inputId={message.id}
          />
        );
      }

      if (message.role === "tool") {
        return null;
      }

      if (message.role === "assistant") {
        return (
          <>
            {/* Always render assistant content through normal path */}
            <div className="thread-message">
              <TimelineItem
                item={item}
                iconElement={
                  <ChatBubbleOvalLeftIcon width="16px" height="16px" />
                }
                open={
                  typeof stepsOpen[index] === "undefined"
                    ? true
                    : stepsOpen[index]!
                }
                onToggle={() => {}}
              >
                <StepContainer
                  index={index}
                  isLast={index === history.length - 1}
                  item={item}
                  latestSummaryIndex={latestSummaryIndex}
                />
              </TimelineItem>
            </div>

            {toolCallStates && (
              <ToolCallDiv
                toolCallStates={toolCallStates}
                historyIndex={index}
              />
            )}
          </>
        );
      }

      if (message.role === "thinking") {
        const thinkingContent = renderChatMessage(message);
        if (!thinkingContent?.trim()) {
          return null;
        }
        return (
          <div className={isBeforeLatestSummary ? "opacity-50" : ""}>
            <ThinkingBlockPeek
              content={thinkingContent}
              redactedThinking={message.redactedThinking}
              index={index}
              prevItem={index > 0 ? history[index - 1] : null}
              inProgress={index === history.length - 1 && isStreaming}
              signature={message.signature}
            />
          </div>
        );
      }

      // Default case - regular assistant message
      return (
        <div className="thread-message">
          <TimelineItem
            item={item}
            iconElement={<ChatBubbleOvalLeftIcon width="16px" height="16px" />}
            open={
              typeof stepsOpen[index] === "undefined" ? true : stepsOpen[index]!
            }
            onToggle={() => {}}
          >
            <StepContainer
              index={index}
              isLast={index === history.length - 1}
              item={item}
              latestSummaryIndex={latestSummaryIndex}
            />
          </TimelineItem>
        </div>
      );
    },
    [sendInput, isLastUserInput, history, stepsOpen, isStreaming],
  );

  const showScrollbar = showChatScrollbar ?? window.innerHeight < 5000;

  // Group consecutive thinking + tool-call items under a single WorkingGroupBox.
  // Pure-text assistant messages and user messages render individually.
  const renderGroups = useMemo(() => {
    type WorkingRun = {
      kind: "working";
      items: ChatHistoryItemWithMessageId[];
      indices: number[];
    };
    type SingleRun = {
      kind: "single";
      item: ChatHistoryItemWithMessageId;
      filteredIndex: number;
    };
    type RenderGroup = WorkingRun | SingleRun;

    const filteredHistory = history.filter(
      (item) => item.message.role !== "system",
    );
    const groups: RenderGroup[] = [];
    let gi = 0;
    while (gi < filteredHistory.length) {
      const item = filteredHistory[gi];
      const role = item.message.role;
      const isWorking =
        role === "thinking" ||
        (role === "assistant" && (item.toolCallStates?.length ?? 0) > 0);

      if (isWorking) {
        const workItems: ChatHistoryItemWithMessageId[] = [];
        const indices: number[] = [];
        while (gi < filteredHistory.length) {
          const curr = filteredHistory[gi];
          const currRole = curr.message.role;
          const currIsPartOfRun =
            currRole === "thinking" ||
            currRole === "tool" ||
            (currRole === "assistant" &&
              (curr.toolCallStates?.length ?? 0) > 0);
          if (!currIsPartOfRun) break;
          // tool messages render as null; keep them in the run but omit from workItems
          if (currRole !== "tool") {
            workItems.push(curr);
            indices.push(gi);
          }
          gi++;
        }
        if (workItems.length > 0) {
          groups.push({ kind: "working", items: workItems, indices });
        }
      } else {
        groups.push({ kind: "single", item, filteredIndex: gi });
        gi++;
      }
    }
    return groups;
  }, [history]);

  const hasTodoMenu = Boolean(latestTodoToolCallState);
  const hasFilesMenu = visibleApplyStates.length > 0;

  return (
    <>
      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} min-h-0 flex-1`}
      >
        {highlights}
        {renderGroups.map((group, groupIndex) => {
          const isLastGroup = groupIndex === renderGroups.length - 1;

          if (group.kind === "single") {
            const { item, filteredIndex } = group;
            return (
              <div
                key={item.message.id}
                style={{ minHeight: isLastGroup ? "200px" : 0 }}
              >
                <ErrorBoundary
                  FallbackComponent={fallbackRender}
                  onReset={() => {
                    dispatch(newSession());
                  }}
                >
                  {renderChatHistoryItem(item, filteredIndex)}
                </ErrorBoundary>
                {isLastGroup && <InlineErrorMessage />}
              </div>
            );
          }

          // Working group — wrap in collapsible WorkingGroupBox
          const { items, indices } = group;
          const isGroupActive = isStreaming && isLastGroup;
          const actionCount = items.reduce(
            (acc, it) => acc + (it.toolCallStates?.length ?? 0),
            0,
          );
          return (
            <div
              key={`working-group-${indices[0]}`}
              style={{ minHeight: isLastGroup ? "200px" : 0 }}
            >
              <WorkingGroupBox
                isActive={isGroupActive}
                actionCount={actionCount}
              >
                {items.map((it, localIdx) => (
                  <ErrorBoundary
                    key={it.message.id}
                    FallbackComponent={fallbackRender}
                    onReset={() => {
                      dispatch(newSession());
                    }}
                  >
                    {renderChatHistoryItem(it, indices[localIdx])}
                  </ErrorBoundary>
                ))}
              </WorkingGroupBox>
              {isLastGroup && <InlineErrorMessage />}
            </div>
          );
        })}
      </StepsDiv>
      <div className="relative shrink-0">
        <div
          className="bg-vsc-input-background sticky bottom-0 z-10 px-2 pt-2"
          data-testid="chat-composer-rail"
        >
          <ContinueInputBox
            isMainInput
            isSubmitting={isSubmittingInput}
            isLastUserInput={false}
            mainInputAuxContent={
              !isInEdit && (hasTodoMenu || hasFilesMenu) ? (
                <>
                  {hasTodoMenu && latestTodoToolCallState && (
                    <TodoListMenu
                      toolCallState={latestTodoToolCallState}
                      roundedTop={true}
                    />
                  )}
                  {hasFilesMenu && (
                    <ModifiedFilesMenu
                      applyStates={visibleApplyStates}
                      roundedTop={!hasTodoMenu}
                    />
                  )}
                </>
              ) : undefined
            }
            onEnter={(editorState, modifiers, editor) =>
              sendInput(editorState, modifiers, undefined, editor)
            }
            inputId={MAIN_EDITOR_INPUT_ID}
          />

          <CliInstallBanner
            sessionCount={allSessionMetadata.length}
            sessionThreshold={3}
            permanentDismissal={true}
          />
        </div>

        <div
          style={{
            pointerEvents: isStreaming ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && lastSessionId && !isInEdit && (
                <NewSessionButton
                  onClick={async () => {
                    await dispatch(loadLastSession());
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-3 w-3" />
                  <span className="text-xs">Last Session</span>
                </NewSessionButton>
              )}
            </div>
            <div className="rounded-xl px-2">
              <AssistantAndOrgListbox variant="lump" />
            </div>
          </div>
          <FatalErrorIndicator />
          {!hasDismissedExploreDialog && <ExploreDialogWatcher />}
          {mode !== "background" && !(mode === "agent" && agentSessionId) && (
            <div className="pb-2">
              <AgentsList isCreatingAgent={isCreatingAgent} variant="compact" />
            </div>
          )}
          {mode !== "background" && !(mode === "agent" && agentSessionId) && (
            <TeamCoordinationPanel />
          )}
          {mode === "background" ? (
            <BackgroundModeView isCreatingAgent={isCreatingAgent} />
          ) : mode === "agent" && agentSessionId ? (
            <AgentChatView
              sessionId={agentSessionId}
              onSessionEnd={() => dispatch(setActiveAgentSessionId(undefined))}
            />
          ) : (
            history.length === 0 && (
              <EmptyChatBody showOnboardingCard={onboardingCard.show} />
            )
          )}
        </div>
      </div>
    </>
  );
}

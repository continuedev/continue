import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/react";
import { InputModifiers, RangeInFileWithContents } from "core";
import { streamResponse } from "core/llm/stream";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { usePostHog } from "posthog-js/react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import styled from "styled-components";
import { Button, lightGray, vscBackground } from "../../components";
import AcceptRejectAllButtons from "../../components/AcceptRejectAllButtons";
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";
import FreeTrialOverDialog from "../../components/dialogs/FreeTrialOverDialog";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import { NewSessionButton } from "../../components/mainInput/belowMainInput/NewSessionButton";
import ThinkingBlockPeek from "../../components/mainInput/belowMainInput/ThinkingBlockPeek";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils";
import { useOnboardingCard } from "../../components/OnboardingCard";
import StepContainer from "../../components/StepContainer";
import { TabBar } from "../../components/TabBar/TabBar";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentToolCall,
  selectCurrentToolCallApplyState,
} from "../../redux/selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setEditStateApplyStatus } from "../../redux/slices/editModeState";
import {
  newSession,
  updateToolCallOutput,
} from "../../redux/slices/sessionSlice";
import {
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiSlice";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { exitEditMode } from "../../redux/thunks/editMode";
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../util";
import {
  FREE_TRIAL_LIMIT_REQUESTS,
  incrementFreeTrialCount,
} from "../../util/freeTrial";

import CodeToEditCard from "../../components/mainInput/CodeToEditCard";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { EmptyChatBody } from "./EmptyChatBody";
import { ExploreDialogWatcher } from "./ExploreDialogWatcher";
import { ToolCallDiv } from "./ToolCallDiv";
import { useAutoScroll } from "./useAutoScroll";

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  .thread-message {
    margin: 0px 0px 0px 1px;
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
  const posthog = usePostHog();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const showSessionTabs = useAppSelector(
    (store) => store.config.config.ui?.showSessionTabs,
  );
  const selectedChatModel = useAppSelector(selectSelectedChatModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const history = useAppSelector((state) => state.session.history);
  const showChatScrollbar = useAppSelector(
    (state) => state.config.config.ui?.showChatScrollbar,
  );
  const codeToEdit = useAppSelector((state) => state.editModeState.codeToEdit);
  const toolCallState = useAppSelector(selectCurrentToolCall);
  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const hasPendingApplies = pendingApplyStates.length > 0;
  const mode = useAppSelector((store) => store.session.mode);
  const lastSessionId = useAppSelector((state) => state.session.lastSessionId);
  const hasDismissedExploreDialog = useAppSelector(
    (state) => state.ui.hasDismissedExploreDialog,
  );
  const jetbrains = isJetBrains();

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        (jetbrains ? e.altKey : isMetaEquivalentKeyPressed(e)) &&
        !e.shiftKey
      ) {
        dispatch(cancelStream());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [isStreaming]);

  const { widget, highlights } = useFindWidget(stepsDivRef);

  const currentToolCallApplyState = useAppSelector(
    selectCurrentToolCallApplyState,
  );

  const sendInput = useCallback(
    (
      editorState: JSONContent,
      modifiers: InputModifiers,
      index?: number,
      editorToClearOnSend?: Editor,
    ) => {
      if (toolCallState?.status === "generated") {
        return console.error(
          "Cannot submit message while awaiting tool confirmation",
        );
      }
      if (
        currentToolCallApplyState &&
        currentToolCallApplyState.status !== "closed"
      ) {
        return console.error(
          "Cannot submit message while awaiting tool call apply",
        );
      }
      if (selectedChatModel?.provider === "free-trial") {
        const newCount = incrementFreeTrialCount();

        if (newCount === FREE_TRIAL_LIMIT_REQUESTS) {
          posthog?.capture("ftc_reached");
        }
        if (newCount >= FREE_TRIAL_LIMIT_REQUESTS) {
          // Show this message whether using platform or not
          // So that something happens if in new chat
          ideMessenger.ide.showToast(
            "error",
            "You've reached the free trial limit. Please configure a model to continue.",
          );

          // Card in chat will only show if no history
          // Also, note that platform card ignore the "Best", always opens to main tab
          onboardingCard.open("Best");

          // If history, show the dialog, which will automatically close if there is not history
          if (history.length) {
            dispatch(setDialogMessage(<FreeTrialOverDialog />));
            dispatch(setShowDialog(true));
          }
          return;
        }
      }

      if (mode === "edit") {
        handleSingleRangeEditOrInsertion(editorState);
        return;
      }

      dispatch(streamResponseThunk({ editorState, modifiers, index }));

      if (editorToClearOnSend) {
        editorToClearOnSend.commands.clearContent();
      }

      // Increment localstorage counter for popup
      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
        if (currentCount === 300) {
          dispatch(setDialogMessage(<FeedbackDialog />));
          dispatch(setDialogEntryOn(false));
          dispatch(setShowDialog(true));
        }
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [
      history,
      selectedChatModel,
      streamResponse,
      mode,
      codeToEdit,
      toolCallState,
    ],
  );

  async function handleSingleRangeEditOrInsertion(editorState: JSONContent) {
    if (!selectedChatModel) {
      console.error("No selected chat model");
      return;
    }

    const [contextItems, __, userInstructions, _] = await resolveEditorContent({
      editorState,
      modifiers: {
        noContext: true,
        useCodebase: false,
      },
      ideMessenger,
      defaultContextProviders: [],
      availableSlashCommands: [],
      dispatch,
    });

    const prompt = [
      ...contextItems.map((item) => item.content),
      stripImages(userInstructions),
    ].join("\n\n");

    ideMessenger.post("edit/sendPrompt", {
      prompt,
      range: codeToEdit[0] as RangeInFileWithContents,
    });

    dispatch(setEditStateApplyStatus("streaming"));
  }

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

  const showScrollbar = showChatScrollbar ?? window.innerHeight > 5000;

  useAutoScroll(stepsDivRef, history);

  return (
    <>
      {widget}

      {!!showSessionTabs && <TabBar />}

      <StepsDiv
        ref={stepsDivRef}
        className={`mt-3 overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 ? "flex-1" : ""}`}
      >
        {highlights}
        {history.map((item, index: number) => (
          <div
            key={item.message.id}
            style={{
              minHeight: index === history.length - 1 ? "25vh" : 0,
            }}
          >
            <ErrorBoundary
              FallbackComponent={fallbackRender}
              onReset={() => {
                dispatch(newSession());
              }}
            >
              {item.message.role === "user" ? (
                <>
                  {mode === "edit" && <CodeToEditCard />}
                  <ContinueInputBox
                    onEnter={(editorState, modifiers) =>
                      sendInput(editorState, modifiers, index)
                    }
                    isLastUserInput={isLastUserInput(index)}
                    isMainInput={mode === "edit"}
                    editorState={item.editorState}
                    contextItems={item.contextItems}
                    inputId={item.message.id}
                  />
                </>
              ) : item.message.role === "tool" ? null : item.message.role === // /> //   toolCallId={item.message.toolCallId} //   contextItems={item.contextItems} // <ToolOutput
                  "assistant" &&
                item.message.toolCalls &&
                item.toolCallState ? (
                <div>
                  {item.message.toolCalls?.map((toolCall, i) => {
                    return (
                      <div key={i}>
                        <ToolCallDiv
                          toolCallState={item.toolCallState!}
                          toolCall={toolCall}
                          output={history[index + 1]?.contextItems}
                          historyIndex={index}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : item.message.role === "thinking" ? (
                <ThinkingBlockPeek
                  content={renderChatMessage(item.message)}
                  redactedThinking={item.message.redactedThinking}
                  index={index}
                  prevItem={index > 0 ? history[index - 1] : null}
                  inProgress={index === history.length - 1}
                  signature={item.message.signature}
                />
              ) : (
                <div className="thread-message">
                  <TimelineItem
                    item={item}
                    iconElement={
                      false ? (
                        <CodeBracketSquareIcon width="16px" height="16px" />
                      ) : false ? (
                        <ExclamationTriangleIcon
                          width="16px"
                          height="16px"
                          color="red"
                        />
                      ) : (
                        <ChatBubbleOvalLeftIcon width="16px" height="16px" />
                      )
                    }
                    open={
                      typeof stepsOpen[index] === "undefined"
                        ? false
                          ? false
                          : true
                        : stepsOpen[index]!
                    }
                    onToggle={() => {}}
                  >
                    <StepContainer
                      index={index}
                      isLast={index === history.length - 1}
                      item={item}
                    />
                  </TimelineItem>
                </div>
              )}
            </ErrorBoundary>
          </div>
        ))}
      </StepsDiv>
      <div className={"relative"}>
        {mode === "edit" && history.length > 0 ? null : (
          <>
            {mode === "edit" && <CodeToEditCard />}
            <ContinueInputBox
              isMainInput
              isLastUserInput={false}
              onEnter={(editorState, modifiers, editor) =>
                sendInput(editorState, modifiers, undefined, editor)
              }
              inputId={MAIN_EDITOR_INPUT_ID}
            />
          </>
        )}

        <div
          style={{
            pointerEvents: isStreaming ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && lastSessionId && mode !== "edit" && (
                <div className="xs:inline hidden">
                  <NewSessionButton
                    onClick={async () => {
                      await dispatch(
                        loadLastSession({
                          saveCurrentSession: true,
                        }),
                      );
                    }}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeftIcon className="h-3 w-3" />
                    <span className="text-xs">Last Session</span>
                  </NewSessionButton>
                </div>
              )}
            </div>
          </div>

          {hasPendingApplies && (
            <AcceptRejectAllButtons
              pendingApplyStates={pendingApplyStates}
              onAcceptOrReject={async (outcome) => {
                if (outcome === "acceptDiff") {
                  await dispatch(
                    loadLastSession({
                      saveCurrentSession: false,
                    }),
                  );
                  dispatch(exitEditMode({}));
                }
              }}
            />
          )}

          {!hasDismissedExploreDialog && <ExploreDialogWatcher />}

          {history.length === 0 && (
            <EmptyChatBody showOnboardingCard={onboardingCard.show} />
          )}
        </div>
      </div>
    </>
  );
}

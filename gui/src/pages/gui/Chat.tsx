import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
} from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";
import { streamResponse } from "core/llm/stream";
import { renderChatMessage } from "core/util/messageContent";
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
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import { NewSessionButton } from "../../components/mainInput/belowMainInput/NewSessionButton";
import ThinkingBlockPeek from "../../components/mainInput/belowMainInput/ThinkingBlockPeek";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
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
import {
  newSession,
  updateToolCallOutput,
} from "../../redux/slices/sessionSlice";
import {
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiSlice";
import { streamEditThunk } from "../../redux/thunks/edit";
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../util";

import { cancelStream } from "../../redux/thunks/cancelStream";
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
  const onboardingCard = useOnboardingCard();
  const showSessionTabs = useAppSelector(
    (store) => store.config.config.ui?.showSessionTabs,
  );
  const selectedModels = useAppSelector(
    (store) => store.config?.config.selectedModelByRole,
  );
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen] = useState<(boolean | undefined)[]>([]);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const history = useAppSelector((state) => state.session.history);
  const showChatScrollbar = useAppSelector(
    (state) => state.config.config.ui?.showChatScrollbar,
  );
  const codeToEdit = useAppSelector((state) => state.editModeState.codeToEdit);
  const toolCallState = useAppSelector(selectCurrentToolCall);
  const mode = useAppSelector((store) => store.session.mode);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);

  const lastSessionId = useAppSelector((state) => state.session.lastSessionId);
  const hasDismissedExploreDialog = useAppSelector(
    (state) => state.ui.hasDismissedExploreDialog,
  );
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
        if (isInEdit) ideMessenger.post("rejectDiff", {});
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

      const model = isInEdit
        ? (selectedModels?.edit ?? selectedModels?.chat)
        : selectedModels?.chat;
      if (!model) {
        return;
      }

      if (isInEdit && codeToEdit.length === 0) {
        return;
      }

      // TODO - hook up with hub to detect free trial progress
      // if (model.provider === "free-trial") {
      //   const newCount = incrementFreeTrialCount();

      //   if (newCount === FREE_TRIAL_LIMIT_REQUESTS) {
      //     posthog?.capture("ftc_reached");
      //   }
      //   if (newCount >= FREE_TRIAL_LIMIT_REQUESTS) {
      //     // Show this message whether using platform or not
      //     // So that something happens if in new chat
      //     void ideMessenger.ide.showToast(
      //       "error",
      //       "You've reached the free trial limit. Please configure a model to continue.",
      //     );

      //     // If history, show the dialog, which will automatically close if there is not history
      //     if (history.length) {
      //       dispatch(setDialogMessage(<FreeTrialOverDialog />));
      //       dispatch(setShowDialog(true));
      //     }
      //     return;
      //   }
      // }

      if (isInEdit) {
        void dispatch(
          streamEditThunk({
            editorState,
            codeToEdit,
          }),
        );
      } else {
        void dispatch(streamResponseThunk({ editorState, modifiers, index }));

        if (editorToClearOnSend) {
          editorToClearOnSend.commands.clearContent();
        }
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
      selectedModels,
      streamResponse,
      mode,
      isInEdit,
      codeToEdit,
      toolCallState,
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

  const showScrollbar = showChatScrollbar ?? window.innerHeight > 5000;

  return (
    <>
      {!!showSessionTabs && !isInEdit && <TabBar ref={tabsRef} />}
      {widget}

      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 ? "flex-1" : ""}`}
      >
        {highlights}
        {history.map((item, index: number) => (
          <div
            key={item.message.id}
            style={{
              minHeight: index === history.length - 1 ? "200px" : 0,
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
                  <ContinueInputBox
                    onEnter={(editorState, modifiers) =>
                      sendInput(editorState, modifiers, index)
                    }
                    isLastUserInput={isLastUserInput(index)}
                    isMainInput={false}
                    editorState={item.editorState}
                    contextItems={item.contextItems}
                    appliedRules={item.appliedRules}
                    inputId={item.message.id}
                  />
                </>
              ) : item.message.role === "tool" ? null : item.message.role === // /> //   toolCallId={item.message.toolCallId} //   contextItems={item.contextItems} // <ToolOutput
                  "assistant" &&
                item.message.toolCalls &&
                item.toolCallState ? (
                <div className="">
                  {item.message.toolCalls?.map((toolCall, i) => {
                    return (
                      <ToolCallDiv
                        key={i}
                        toolCallState={item.toolCallState!}
                        toolCall={toolCall}
                        output={history[index + 1]?.contextItems}
                        historyIndex={index}
                      />
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
                    />
                  </TimelineItem>
                </div>
              )}
            </ErrorBoundary>
          </div>
        ))}
      </StepsDiv>
      <div className={"relative"}>
        <ContinueInputBox
          isMainInput
          isLastUserInput={false}
          onEnter={(editorState, modifiers, editor) =>
            sendInput(editorState, modifiers, undefined, editor)
          }
          inputId={MAIN_EDITOR_INPUT_ID}
        />

        <div
          style={{
            pointerEvents: isStreaming ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && lastSessionId && !isInEdit && (
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
          {!hasDismissedExploreDialog && <ExploreDialogWatcher />}
          {history.length === 0 && (
            <EmptyChatBody showOnboardingCard={onboardingCard.show} />
          )}
        </div>
      </div>
    </>
  );
}

import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/react";
import { InputModifiers, RangeInFileWithContents, ToolCallState } from "core";
import { streamResponse } from "core/llm/stream";
import { stripImages } from "core/util/messageContent";
import { usePostHog } from "posthog-js/react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
} from "../../components";
import CodeToEditCard from "../../components/CodeToEditCard";
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";
import FreeTrialOverDialog from "../../components/dialogs/FreeTrialOverDialog";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import ChatIndexingPeeks from "../../components/indexing/ChatIndexingPeeks";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { NewSessionButton } from "../../components/mainInput/NewSessionButton";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import { TutorialCard } from "../../components/mainInput/TutorialCard";
import AssistantSelect from "../../components/modelSelection/platform/AssistantSelect";
import {
  OnboardingCard,
  useOnboardingCard,
} from "../../components/OnboardingCard";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import PageHeader from "../../components/PageHeader";
import StepContainer from "../../components/StepContainer";
import AcceptRejectAllButtons from "../../components/StepContainer/AcceptRejectAllButtons";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useTutorialCard } from "../../hooks/useTutorialCard";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseHub } from "../../redux/selectors";
import { selectCurrentToolCall } from "../../redux/selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import { submitEdit } from "../../redux/slices/editModeState";
import {
  clearLastEmptyResponse,
  newSession,
  selectIsInEditMode,
  selectIsSingleRangeEditOrInsertion,
  setInactive,
} from "../../redux/slices/sessionSlice";
import {
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiSlice";
import { RootState } from "../../redux/store";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { exitEditMode } from "../../redux/thunks/exitEditMode";
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import {
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import {
  FREE_TRIAL_LIMIT_REQUESTS,
  incrementFreeTrialCount,
} from "../../util/freeTrial";
import getMultifileEditPrompt from "../../util/getMultifileEditPrompt";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import ConfigErrorIndicator from "./ConfigError";
import { ToolCallDiv } from "./ToolCallDiv";
import { ToolCallButtons } from "./ToolCallDiv/ToolCallButtonsDiv";
import ToolOutput from "./ToolCallDiv/ToolOutput";

const StopButton = styled.div`
  background-color: ${vscBackground};
  width: fit-content;
  margin-right: auto;
  margin-left: auto;
  font-size: ${getFontSize() - 2}px;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  color: ${lightGray};
  cursor: pointer;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow:
      0 6px 8px rgba(0, 0, 0, 0.15),
      0 3px 6px rgba(0, 0, 0, 0.1);
  }
`;

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  .thread-message {
    margin: 0px 4px 0 4px;
  }
`;

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

const useAutoScroll = (
  ref: React.RefObject<HTMLDivElement>,
  history: unknown[],
) => {
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  useEffect(() => {
    if (history.length) {
      setUserHasScrolled(false);
    }
  }, [history.length]);

  useEffect(() => {
    if (!ref.current || history.length === 0) return;

    const handleScroll = () => {
      const elem = ref.current;
      if (!elem) return;

      const isAtBottom =
        Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1;

      /**
       * We stop auto scrolling if a user manually scrolled up.
       * We resume auto scrolling if a user manually scrolled to the bottom.
       */
      setUserHasScrolled(!isAtBottom);
    };

    const resizeObserver = new ResizeObserver(() => {
      const elem = ref.current;
      if (!elem || userHasScrolled) return;
      elem.scrollTop = elem.scrollHeight;
    });

    ref.current.addEventListener("scroll", handleScroll);

    // Observe the container
    resizeObserver.observe(ref.current);

    // Observe all immediate children
    Array.from(ref.current.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      resizeObserver.disconnect();
      ref.current?.removeEventListener("scroll", handleScroll);
    };
  }, [ref, history.length, userHasScrolled]);
};

export function Chat() {
  const posthog = usePostHog();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const { showTutorialCard, closeTutorialCard } = useTutorialCard();
  const selectedModelTitle = useAppSelector(
    (store) => store.config.defaultModelTitle,
  );
  const defaultModel = useAppSelector(selectDefaultModel);
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const history = useAppSelector((state) => state.session.history);
  const showChatScrollbar = useAppSelector(
    (state) => state.config.config.ui?.showChatScrollbar,
  );
  const codeToEdit = useAppSelector((state) => state.session.codeToEdit);
  const toolCallState = useSelector<RootState, ToolCallState | undefined>(
    selectCurrentToolCall,
  );
  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const hasPendingApplies = pendingApplyStates.length > 0;
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const isSingleRangeEditOrInsertion = useAppSelector(
    selectIsSingleRangeEditOrInsertion,
  );
  const lastSessionId = useAppSelector((state) => state.session.lastSessionId);
  const useHub = useAppSelector(selectUseHub);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
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

  const sendInput = useCallback(
    (
      editorState: JSONContent,
      modifiers: InputModifiers,
      index?: number,
      editorToClearOnSend?: Editor,
    ) => {
      if (defaultModel?.provider === "free-trial") {
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

      if (isSingleRangeEditOrInsertion) {
        handleSingleRangeEditOrInsertion(editorState);
        return;
      }

      const promptPreamble = isInEditMode
        ? getMultifileEditPrompt(codeToEdit)
        : undefined;

      dispatch(
        streamResponseThunk({ editorState, modifiers, promptPreamble, index }),
      );

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
      defaultModel,
      streamResponse,
      isSingleRangeEditOrInsertion,
      codeToEdit,
    ],
  );

  async function handleSingleRangeEditOrInsertion(editorState: JSONContent) {
    const [contextItems, __, userInstructions] = await resolveEditorContent({
      editorState,
      modifiers: {
        noContext: true,
        useCodebase: false,
      },
      ideMessenger,
      defaultContextProviders: [],
      dispatch,
      selectedModelTitle,
    });

    const prompt = [
      ...contextItems.map((item) => item.content),
      stripImages(userInstructions),
    ].join("\n\n");

    ideMessenger.post("edit/sendPrompt", {
      prompt,
      range: codeToEdit[0] as RangeInFileWithContents,
    });

    dispatch(submitEdit(prompt));
  }

  useWebviewListener(
    "newSession",
    async () => {
      // unwrapResult(response) // errors if session creation failed
      mainTextInputRef.current?.focus?.();
    },
    [mainTextInputRef],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      return !history
        .slice(index + 1)
        .some((entry) => entry.message.role === "user");
    },
    [history],
  );

  const showScrollbar = showChatScrollbar || window.innerHeight > 5000;

  useAutoScroll(stepsDivRef, history);

  const showPageHeader = isInEditMode || useHub;

  return (
    <>
      {showPageHeader && (
        <PageHeader
          title={isInEditMode ? "Edit Mode" : ""}
          onTitleClick={
            isInEditMode
              ? async () => {
                  await dispatch(
                    loadLastSession({ saveCurrentSession: false }),
                  );
                  dispatch(exitEditMode());
                }
              : undefined
          }
          rightContent={useHub && <AssistantSelect />}
        />
      )}

      {widget}

      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll ${showPageHeader ? "" : "pt-[8px]"} ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 ? "flex-1" : ""}`}
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
                  {isInEditMode && index === 0 && <CodeToEditCard />}
                  <ContinueInputBox
                    isEditMode={isInEditMode}
                    onEnter={(editorState, modifiers) =>
                      sendInput(editorState, modifiers, index)
                    }
                    isLastUserInput={isLastUserInput(index)}
                    isMainInput={false}
                    editorState={item.editorState}
                    contextItems={item.contextItems}
                    inputId={item.message.id}
                  />
                </>
              ) : item.message.role === "tool" ? (
                <ToolOutput
                  contextItems={item.contextItems}
                  toolCallId={item.message.toolCallId}
                />
              ) : item.message.role === "assistant" &&
                item.message.toolCalls &&
                item.toolCallState ? (
                <div>
                  {item.message.toolCalls?.map((toolCall, i) => {
                    return (
                      <div key={i}>
                        <ToolCallDiv
                          toolCallState={item.toolCallState!}
                          toolCall={toolCall}
                        />
                      </div>
                    );
                  })}
                </div>
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
      <div className={`relative`}>
        <div className="absolute -top-8 right-2 z-30">
          {ttsActive && (
            <StopButton
              className=""
              onClick={() => {
                ideMessenger.post("tts/kill", undefined);
              }}
            >
              ■ Stop TTS
            </StopButton>
          )}
          {isStreaming && (
            <StopButton
              onClick={() => {
                dispatch(setInactive());
                dispatch(clearLastEmptyResponse());
              }}
            >
              {getMetaKeyLabel()} ⌫ Cancel
            </StopButton>
          )}
        </div>

        {toolCallState?.status === "generated" && <ToolCallButtons />}

        {isInEditMode && history.length === 0 && <CodeToEditCard />}

        {isInEditMode && history.length > 0 ? null : (
          <ContinueInputBox
            isMainInput
            isEditMode={isInEditMode}
            isLastUserInput={false}
            onEnter={(editorState, modifiers, editor) =>
              sendInput(editorState, modifiers, undefined, editor)
            }
            inputId={"main-editor"}
          />
        )}

        <div
          style={{
            pointerEvents: isStreaming ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && lastSessionId && !isInEditMode && (
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
                    Last Session
                  </NewSessionButton>
                </div>
              )}
            </div>
            <ConfigErrorIndicator />
          </div>

          {hasPendingApplies && isSingleRangeEditOrInsertion && (
            <AcceptRejectAllButtons
              pendingApplyStates={pendingApplyStates}
              onAcceptOrReject={async (outcome) => {
                if (outcome === "acceptDiff") {
                  await dispatch(
                    loadLastSession({
                      saveCurrentSession: false,
                    }),
                  );
                  dispatch(exitEditMode());
                }
              }}
            />
          )}

          {history.length === 0 && (
            <>
              {onboardingCard.show && (
                <div className="mx-2 mt-10">
                  {useHub ? (
                    <PlatformOnboardingCard isDialog={false} />
                  ) : (
                    <OnboardingCard isDialog={false} />
                  )}
                </div>
              )}

              {showTutorialCard !== false && !onboardingCard.show && (
                <div className="flex w-full justify-center">
                  <TutorialCard onClose={closeTutorialCard} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div
        className={`${history.length === 0 ? "h-full" : ""} flex flex-col justify-end`}
      >
        <ChatIndexingPeeks />
      </div>
    </>
  );
}

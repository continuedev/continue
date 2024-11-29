import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { JSONContent } from "@tiptap/react";
import { InputModifiers, ToolCallState } from "core";
import { streamResponse } from "core/llm/stream";
import { usePostHog } from "posthog-js/react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
} from "../../components";
import { ChatScrollAnchor } from "../../components/ChatScrollAnchor";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import ChatIndexingPeeks from "../../components/indexing/ChatIndexingPeeks";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { NewSessionButton } from "../../components/mainInput/NewSessionButton";
import { TutorialCard } from "../../components/mainInput/TutorialCard";
import {
  OnboardingCard,
  useOnboardingCard,
} from "../../components/OnboardingCard";
import StepContainer from "../../components/StepContainer";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import useHistory from "../../hooks/useHistory";
import { useTutorialCard } from "../../hooks/useTutorialCard";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import { selectCurrentToolCall } from "../../redux/selectors/selectCurrentToolCall";
import {
  clearLastEmptyResponse,
  newSession,
  setInactive,
} from "../../redux/slices/stateSlice";
import {
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState, useAppDispatch } from "../../redux/store";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import {
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../util/freeTrial";
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

export function Chat() {
  const posthog = usePostHog();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const { showTutorialCard, closeTutorialCard } = useTutorialCard();
  const defaultModel = useSelector(defaultModelSelector);
  const ttsActive = useSelector((state: RootState) => state.state.ttsActive);
  const active = useSelector((state: RootState) => state.state.active);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const history = useSelector((store: RootState) => store.state.history);
  const showChatScrollbar = useSelector(
    (store: RootState) => store.state.config?.ui?.showChatScrollbar,
  );
  const { saveSession, getLastSessionId, loadLastSession } =
    useHistory(dispatch);

  const toolCallState = useSelector<RootState, ToolCallState | undefined>(
    selectCurrentToolCall,
  );

  const snapToBottom = useCallback(() => {
    if (!stepsDivRef.current) return;
    const elem = stepsDivRef.current;
    elem.scrollTop = elem.scrollHeight - elem.clientHeight;

    setIsAtBottom(true);
  }, [stepsDivRef, setIsAtBottom]);

  const smoothScrollToBottom = useCallback(async () => {
    if (!stepsDivRef.current) return;
    const elem = stepsDivRef.current;
    elem.scrollTo({
      top: elem.scrollHeight - elem.clientHeight,
      behavior: "smooth",
    });

    setIsAtBottom(true);
  }, [stepsDivRef, setIsAtBottom]);

  useEffect(() => {
    if (active) snapToBottom();
  }, [active, snapToBottom]);

  // useEffect(() => {
  //   setTimeout(() => {
  //     smoothScrollToBottom();
  //   }, 400);
  // }, [smoothScrollToBottom, state.sessionId]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey
      ) {
        dispatch(cancelGeneration());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [active]);

  const handleScroll = () => {
    // Temporary fix to account for additional height when code blocks are added
    const OFFSET_HERUISTIC = 300;
    if (!stepsDivRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = stepsDivRef.current;
    const atBottom =
      scrollHeight - clientHeight <= scrollTop + OFFSET_HERUISTIC;

    setIsAtBottom(atBottom);
  };

  const { widget, highlights } = useFindWidget(stepsDivRef);

  const sendInput = useCallback(
    (editorState: JSONContent, modifiers: InputModifiers) => {
      if (defaultModel?.provider === "free-trial") {
        const u = getLocalStorage("ftc");
        if (u) {
          setLocalStorage("ftc", u + 1);

          if (u >= FREE_TRIAL_LIMIT_REQUESTS) {
            onboardingCard.open("Best");
            posthog?.capture("ftc_reached");
            ideMessenger.ide.showToast(
              "info",
              "You've reached the free trial limit. Please configure a model to continue.",
            );
            return;
          }
        } else {
          setLocalStorage("ftc", 1);
        }
      }

      dispatch(streamResponseThunk({ editorState, modifiers }));

      // Increment localstorage counter for popup
      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
        if (currentCount === 300) {
          dispatch(
            setDialogMessage(
              <div className="p-4 text-center">
                👋 Thanks for using Continue. We are always trying to improve
                and love hearing from users. If you're interested in speaking,
                enter your name and email. We won't use this information for
                anything other than reaching out.
                <br />
                <br />
                <form
                  onSubmit={(e: any) => {
                    e.preventDefault();
                    posthog?.capture("user_interest_form", {
                      name: e.target.elements[0].value,
                      email: e.target.elements[1].value,
                    });
                    dispatch(
                      setDialogMessage(
                        <div className="p-4 text-center">
                          Thanks! We'll be in touch soon.
                        </div>,
                      ),
                    );
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <input
                    style={{ padding: "10px", borderRadius: "5px" }}
                    type="text"
                    name="name"
                    placeholder="Name"
                    required
                  />
                  <input
                    style={{ padding: "10px", borderRadius: "5px" }}
                    type="email"
                    name="email"
                    placeholder="Email"
                    required
                  />
                  <button
                    style={{
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                    type="submit"
                  >
                    Submit
                  </button>
                </form>
              </div>,
            ),
          );
          dispatch(setDialogEntryOn(false));
          dispatch(setShowDialog(true));
        }
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [history, defaultModel, streamResponse],
  );

  useWebviewListener(
    "newSession",
    async () => {
      saveSession();
      mainTextInputRef.current?.focus?.();
    },
    [saveSession],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      return !history
        .slice(index + 1)
        .some((entry) => entry.message.role === "user");
    },
    [history],
  );

  const showScrollbar = useMemo(() => {
    return showChatScrollbar ?? window.innerHeight > 5000;
  }, [showChatScrollbar]);

  return (
    <>
      {widget}
      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 ? "flex-1" : ""}`}
        onScroll={handleScroll}
      >
        {highlights}
        {history.map((item, index: number) => (
          <div
            key={item.message.id}
            style={{
              minHeight: index === history.length - 1 ? "50vh" : 0,
            }}
          >
            <ErrorBoundary
              FallbackComponent={fallbackRender}
              onReset={() => {
                dispatch(newSession());
              }}
            >
              {item.message.role === "user" ? (
                <ContinueInputBox
                  onEnter={async (editorState, modifiers) => {
                    dispatch(
                      streamResponseThunk({ editorState, modifiers, index }),
                    );
                  }}
                  isLastUserInput={isLastUserInput(index)}
                  isMainInput={false}
                  editorState={item.editorState}
                  contextItems={item.contextItems}
                />
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
                      <ToolCallDiv
                        key={i}
                        toolCallState={item.toolCallState}
                        toolCall={toolCall as any}
                      />
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
        <ChatScrollAnchor
          scrollAreaRef={stepsDivRef}
          isAtBottom={isAtBottom}
          trackVisibility={active}
        />
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
          {active && (
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
        <ContinueInputBox
          isMainInput
          isLastUserInput={false}
          onEnter={(editorContent, modifiers) => {
            sendInput(editorContent, modifiers);
          }}
        />
        <div
          style={{
            pointerEvents: active ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && getLastSessionId() ? (
                <div className="xs:inline hidden">
                  <NewSessionButton
                    onClick={async () => {
                      loadLastSession().catch((e) =>
                        console.error(`Failed to load last session: ${e}`),
                      );
                    }}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeftIcon className="h-3 w-3" />
                    Last Session
                  </NewSessionButton>
                </div>
              ) : null}
            </div>
            <ConfigErrorIndicator />
          </div>

          {history.length === 0 && (
            <>
              {onboardingCard.show && (
                <div className="mx-2 mt-10">
                  <OnboardingCard activeTab={onboardingCard.activeTab} />
                </div>
              )}

              {showTutorialCard !== false && !onboardingCard.open && (
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
function cancelGeneration(): any {
  throw new Error("Function not implemented.");
}

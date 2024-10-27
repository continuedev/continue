import { JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";
import { usePostHog } from "posthog-js/react";
import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
} from "../../components";
import { ChatScrollAnchor } from "../../components/ChatScrollAnchor";
import StepContainer from "../../components/gui/StepContainer";
import TimelineItem from "../../components/gui/TimelineItem";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { defaultInputModifiers } from "../../components/mainInput/inputModifiers";
import { TutorialCard } from "../../components/mainInput/TutorialCard";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import useChatHandler from "../../hooks/useChatHandler";
import useHistory from "../../hooks/useHistory";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import {
  clearLastResponse,
  deleteMessage,
  newSession,
  setAiderInactive,
  updateAiderProcessStatus,
} from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../util/freeTrial";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { Badge } from "../../components/ui/badge";
import {
  TopGuiDiv,
  StopButton,
  StepsDiv,
  NewSessionButton,
  fallbackRender,
} from "../../pages/gui";

function AiderGUI() {
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const isBetaAccess = useSelector(
    (state: RootState) => state.state.config.isBetaAccess,
  );
  const aiderProcessStatus = useSelector(
    (state: RootState) => state.state.aiderProcessStatus,
  );

  const sessionState = useSelector((state: RootState) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const active = useSelector((state: RootState) => state.state.aiderActive);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);

  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const topGuiDivRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const state = useSelector((state: RootState) => state.state);

  const handleScroll = () => {
    const OFFSET_HERUISTIC = 300;
    if (!topGuiDivRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = topGuiDivRef.current;
    const atBottom =
      scrollHeight - clientHeight <= scrollTop + OFFSET_HERUISTIC;

    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    if (!active || !topGuiDivRef.current) return;
    const scrollAreaElement = topGuiDivRef.current;
    scrollAreaElement.scrollTop =
      scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight;
    setIsAtBottom(true);
  }, [active]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      window.scrollTo({
        top: topGuiDivRef.current?.scrollHeight,
        behavior: "instant" as any,
      });
    }, 1);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [topGuiDivRef.current]);

  useEffect(() => {
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey
      ) {
        dispatch(setAiderInactive());
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);

  const { streamResponse } = useChatHandler(dispatch, ideMessenger, 'aider');

  const sendInput = useCallback(
    (editorState: JSONContent, modifiers: InputModifiers) => {
      if (defaultModel?.provider === "free-trial") {
        const u = getLocalStorage("ftc");
        if (u) {
          setLocalStorage("ftc", u + 1);
          if (u >= FREE_TRIAL_LIMIT_REQUESTS) {
            navigate("/onboarding");
            posthog?.capture("ftc_reached");
            return;
          }
        } else {
          setLocalStorage("ftc", 1);
        }
      }

      streamResponse(editorState, modifiers, ideMessenger, null, "aider");

      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [
      sessionState.aiderHistory,
      sessionState.contextItems,
      defaultModel,
      state,
      streamResponse,
    ],
  );

  const { saveSession } = useHistory(dispatch, "aider");

  useWebviewListener(
    "newSession",
    async () => {
      saveSession();
      mainTextInputRef.current?.focus?.();
    },
    [saveSession],
  );

  useWebviewListener(
    "aiderProcessStateUpdate",
    async (data) => {
      dispatch(updateAiderProcessStatus({ status: data.status }));
    },
    [],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      let foundLaterUserInput = false;
      for (let i = index + 1; i < state.aiderHistory.length; i++) {
        if (state.aiderHistory[i].message.role === "user") {
          foundLaterUserInput = true;
          break;
        }
      }
      return !foundLaterUserInput;
    },
    [state.aiderHistory],
  );

  return (
    <>
      <TopGuiDiv ref={topGuiDivRef} onScroll={handleScroll}>
        <div className="mx-2">
          <div className="pl-2 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold mb-2">
                PearAI Creator - Beta
              </h1>
              <Badge variant="outline" className="pl-0">
                Beta (Powered by{" "}
                <a
                  href="https://aider.chat/2024/06/02/main-swe-bench.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline px-1"
                >
                  aider)
                </a>
              </Badge>
            </div>
            <div className="flex items-center mt-0 justify-between pr-1">
              <p className="text-sm text-gray-400 m-0">
                Ask for a feature, describe a bug to fix, or ask for a change to
                your project. Creator will make and apply the changes to your
                files directly.
              </p>
            </div>
          </div>
            <>
          <StepsDiv>
            {state.aiderHistory.map((item, index: number) => (
              <Fragment key={index}>
                <ErrorBoundary
                  FallbackComponent={fallbackRender}
                  onReset={() => {
                    dispatch(newSession({session: undefined, source: 'aider'}));
                  }}
                >
                  {item.message.role === "user" ? (
                    <ContinueInputBox
                      onEnter={async (editorState, modifiers) => {
                        streamResponse(
                          editorState,
                          modifiers,
                          ideMessenger,
                          index,
                          "aider",
                        );
                      }}
                      isLastUserInput={isLastUserInput(index)}
                      isMainInput={false}
                      editorState={item.editorState}
                      contextItems={item.contextItems}
                      source="aider"
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
                          isLast={
                            index === sessionState.aiderHistory.length - 1
                          }
                          isFirst={index === 0}
                          open={
                            typeof stepsOpen[index] === "undefined"
                              ? true
                              : stepsOpen[index]!
                          }
                          key={index}
                          onUserInput={(input: string) => {}}
                          item={item}
                          onReverse={() => {}}
                          onRetry={() => {
                            streamResponse(
                              state.aiderHistory[index - 1].editorState,
                              state.aiderHistory[index - 1].modifiers ??
                                defaultInputModifiers,
                              ideMessenger,
                              index - 1,
                              "aider",
                            );
                          }}
                          onContinueGeneration={() => {
                            window.postMessage(
                              {
                                messageType: "userInput",
                                data: {
                                  input: "Keep going.",
                                },
                              },
                              "*",
                            );
                          }}
                          onDelete={() => {
                            dispatch(
                              deleteMessage({
                                index: index + 1,
                                source: "aider",
                              }),
                            );
                          }}
                          modelTitle={
                            item.promptLogs?.[0]?.completionOptions?.model ?? ""
                          }
                          source="aider"
                        />
                      </TimelineItem>
                    </div>
                  )}
                </ErrorBoundary>
              </Fragment>
            ))}
          </StepsDiv>
          <ContinueInputBox
            onEnter={(editorContent, modifiers) => {
              sendInput(editorContent, modifiers);
            }}
            isLastUserInput={false}
            isMainInput={true}
            hidden={active}
            source="aider"
          />
          </>
          {active ? (
            <>
              <br />
              <br />
            </>
          ) : state.aiderHistory.length > 0 ? (
            <div className="mt-2">
              <NewSessionButton
                onClick={() => {
                  saveSession();
                  ideMessenger.post("aiderResetSession", undefined);
                }}
                className="mr-auto"
              >
                Clear chat
              </NewSessionButton>
            </div>
          ) : null}
        </div>
        <ChatScrollAnchor
          scrollAreaRef={topGuiDivRef}
          isAtBottom={isAtBottom}
          trackVisibility={active}
        />

      </TopGuiDiv>
      {active && (
        <StopButton
          className="mt-auto mb-4 sticky bottom-4"
          onClick={() => {
            dispatch(setAiderInactive());
            if (
              state.aiderHistory[state.aiderHistory.length - 1]?.message.content
                .length === 0
            ) {
              dispatch(clearLastResponse("aider"));
            }
            ideMessenger.post("aiderCtrlC", undefined);
          }}
        >
          {getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      )}
    </>
  );
}

export default AiderGUI;

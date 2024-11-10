import { JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";
import { usePostHog } from "posthog-js/react";
import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
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
import { Link, useNavigate } from "react-router-dom";
import { ChatScrollAnchor } from "../../components/ChatScrollAnchor";
import StepContainer from "../../components/gui/StepContainer";
import TimelineItem from "../../components/gui/TimelineItem";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { defaultInputModifiers } from "../../components/mainInput/inputModifiers";
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
import { CustomTutorialCard } from "@/components/mainInput/CustomTutorialCard";
import AiderManualInstallation from "./AiderManualInstallation";
import { cn } from "@/lib/utils";
import type { AiderState } from "../../../../extensions/vscode/src/integrations/aider/types/aiderTypes";

function AiderGUI() {
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const sessionState = useSelector((state: RootState) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const active = useSelector((state: RootState) => state.state.aiderActive);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);

  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const topGuiDivRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const state = useSelector((state: RootState) => state.state);
  const [aiderProcessState, setAiderProcessState] = useState<AiderState>({
    state: "starting",
  });

  // TODO: Remove this later. This is supposed to be set in Onboarding, but
  // many users won't reach onboarding screen due to cache. So set it manually,
  // and on next release we remove it.
  setLocalStorage("showAiderTutorialCard", true);
  const [showAiderTutorialCard, setShowAiderTutorialCard] = useState<boolean>(
    getLocalStorage("showAiderTutorialCard"),
  );
  const onCloseTutorialCard = () => {
    posthog.capture("closedAiderTutorialCard");
    setLocalStorage("showAiderTutorialCard", false);
    setShowAiderTutorialCard(false);
  };

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
      } else if (
        e.key === "." &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey
      ) {
        saveSession();
        ideMessenger.post("aiderResetSession", undefined);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);

  const { streamResponse } = useChatHandler(dispatch, ideMessenger, "aider");

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

  useEffect(() => {
    ideMessenger.request("refreshAiderProcessState", undefined);
  }, []);

  useWebviewListener("setAiderProcessStateInGUI", async (data) => {
    if (data) {
      setAiderProcessState(data);
    }
  });

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

  if (aiderProcessState.state !== "ready") {
    let msg: string | JSX.Element = "";
    if (aiderProcessState.state === "signedOut") {
      msg = (
        <>
          Please{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              ideMessenger.post("pearaiLogin", undefined);
            }}
            className="underline text-foreground"
          >
            sign in
          </a>{" "}
          to use PearAI Creator.
        </>
      );
    }
    if (aiderProcessState.state === "stopped") {
      msg = (
        <>
          PearAI Creator (Powered By aider) process is not running. Please view{" "}
          <a
            href="https://trypear.ai/creator-troubleshooting"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-foreground"
          >
            troubleshooting
          </a>
          .
        </>
      );
    }
    if (aiderProcessState.state === "crashed") {
      msg = (
        <>
          PearAI Creator (Powered By aider) process has failed. Please ensure a
          folder is open, and view troubleshooting{" "}
          <a
            href="https://trypear.ai/creator-troubleshooting"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-foreground"
          >
            here
          </a>
          .
        </>
      );
    }
    if (aiderProcessState.state === "uninstalled") {
      return <AiderManualInstallation />;
    }
    if (aiderProcessState.state === "starting") {
      msg =
        "Spinning up PearAI Creator (Powered By aider), please give it a second...";
    }

    return (
      <div className="top-[200px] left-0 w-full h-[calc(100%-200px)] bg-opacity-50 z-10 flex items-center justify-center">
        <div className="text-2xl">
          <div className="spinner" role="status">
            <span>{msg}</span>
          </div>
          {(aiderProcessState.state === "stopped" ||
            aiderProcessState.state === "crashed") && (
            <div className="flex justify-center">
              <button
                className="mt-4 font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                onClick={() =>
                  ideMessenger.post("aiderResetSession", undefined)
                }
              >
                Restart
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <TopGuiDiv ref={topGuiDivRef} onScroll={handleScroll}>
        <div
          className={cn(
            "mx-2",
            state.aiderHistory.length === 0 &&
              "h-full flex flex-col justify-center",
          )}
        >
          {state.aiderHistory.length === 0 ? (
            <div className="max-w-2xl mx-auto w-full text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">PearAI Creator</h1>
                <Badge variant="outline" className="pl-0">
                  Beta (Powered by aider*)
                </Badge>
              </div>
              <p className="text-sm text-foreground">
                Ask for a feature, describe a bug to fix, or ask for a change to
                your project. Creator will make and apply the changes to your
                files directly.
              </p>
            </div>
          ) : (
            <div className="pl-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold mb-2">PearAI Creator</h1>
                <Badge variant="outline" className="pl-0">
                  Beta (Powered by aider*)
                </Badge>
              </div>
              <div className="flex items-center mt-0 justify-between pr-1">
                <p className="text-sm text-foreground m-0">
                  Ask for a feature, describe a bug to fix, or ask for a change
                  to your project. Creator will make and apply the changes to
                  your files directly.
                </p>
                {state.aiderHistory.length > 0 && (
                  <div>
                    <NewSessionButton
                      onClick={() => {
                        saveSession();
                        ideMessenger.post("aiderResetSession", undefined);
                      }}
                      className="mr-auto"
                    >
                      Clear chat (<kbd>{getMetaKeyLabel()}</kbd> <kbd>.</kbd>)
                    </NewSessionButton>
                  </div>
                )}
              </div>
            </div>
          )}

          <>
            <StepsDiv>
              {state.aiderHistory.map((item, index: number) => (
                <Fragment key={index}>
                  <ErrorBoundary
                    FallbackComponent={fallbackRender}
                    onReset={() => {
                      dispatch(
                        newSession({ session: undefined, source: "aider" }),
                      );
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
                            <ChatBubbleOvalLeftIcon
                              width="16px"
                              height="16px"
                            />
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
                                  index: index,
                                  source: "aider",
                                }),
                              );
                            }}
                            modelTitle={
                              item.promptLogs?.[0]?.completionOptions?.model ??
                              ""
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

            <div
              className={cn(
                "transition-all duration-300",
                state.aiderHistory.length === 0
                  ? "max-w-2xl mx-auto w-full"
                  : "w-full",
              )}
            >
              <ContinueInputBox
                onEnter={(editorContent, modifiers) => {
                  sendInput(editorContent, modifiers);
                }}
                isLastUserInput={false}
                isMainInput={true}
                hidden={active}
                source="aider"
                className={cn(
                  "transition-all duration-300",
                  state.aiderHistory.length === 0 && "shadow-lg",
                )}
              />
            </div>
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
                Clear chat (<kbd>{getMetaKeyLabel()}</kbd> <kbd>.</kbd>)
              </NewSessionButton>
            </div>
          ) : (
            <>
              {" "}
              {/** TODO: Prevent removing tutorial card for now. Set to showAiderTutorialCard later */}
              {true && (
                <div className="flex justify-center w-full mt-10">
                  <CustomTutorialCard
                    content={tutorialContent}
                    onClose={onCloseTutorialCard}
                  />{" "}
                </div>
              )}
            </>
          )}
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
      <div className="text-[10px] text-muted-foreground mt-4 flex justify-end pr-2 pb-2">
        *View PearAI Disclaimer page{" "}
        <Link
          to="https://trypear.ai/disclaimer/"
          target="_blank"
          className="text-muted-foreground no-underline hover:no-underline ml-1"
        >
          here
        </Link>
        .
      </div>
    </>
  );
}

export default AiderGUI;

const tutorialContent = {
  goodFor: "Direct feature implementations, bug fixes, code refactoring",
  notGoodFor:
    "Questions unrelated to feature creation and bugs (use PearAI Chat instead)",
  example: {
    text: '"Make a new FAQ page for my website"',
    copyText: "Make a new FAQ page for my website",
  },
  moreInfo: [
    "- Ignore system ```<<< SEARCH REPLACE >>>``` messages. These are for the system to make edits for you automatically.",
  ],
};

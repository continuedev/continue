import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import { JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";
import { usePostHog } from "posthog-js/react";
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
import { useNavigate } from "react-router-dom";
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
  setPerplexityInactive,
} from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../util/freeTrial";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { isBareChatMode } from "../../util/bareChatMode";
import { Badge } from "../../components/ui/badge";
import {
  TopGuiDiv,
  StopButton,
  StepsDiv,
  NewSessionButton,
  fallbackRender,
} from "../../pages/gui";
import { CustomTutorialCard } from "@/components/mainInput/CustomTutorialCard";

function PerplexityGUI() {
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const sessionState = useSelector((state: RootState) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const active = useSelector(
    (state: RootState) => state.state.perplexityActive,
  );
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const topGuiDivRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const state = useSelector((state: RootState) => state.state);
  // TODO: Remove this later. This is supposed to be set in Onboarding, but
  // many users won't reach onboarding screen due to cache. So set it manually,
  // and on next release we remove it.
  setLocalStorage("showPerplexityTutorialCard", true);
  const [showPerplexityTutorialCard, setShowPerplexityTutorialCard] =
    useState<boolean>(getLocalStorage("showPerplexityTutorialCard"));

  const onCloseTutorialCard = () => {
    posthog.capture("closedPerplexityTutorialCard");
    setLocalStorage("showPerplexityTutorialCard", false);
    setShowPerplexityTutorialCard(false);
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
        dispatch(setPerplexityInactive());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [active]);

  const { streamResponse } = useChatHandler(
    dispatch,
    ideMessenger,
    "perplexity",
  );

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

      streamResponse(editorState, modifiers, ideMessenger, null, "perplexity");

      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [
      sessionState.perplexityHistory,
      sessionState.contextItems,
      defaultModel,
      state,
      streamResponse,
    ],
  );

  const { saveSession, getLastSessionId, loadLastSession, loadMostRecentChat } =
    useHistory(dispatch, "perplexity");

  useWebviewListener(
    "newSession",
    async () => {
      saveSession();
      mainTextInputRef.current?.focus?.();
    },
    [saveSession],
  );

  useWebviewListener(
    "loadMostRecentChat",
    async () => {
      await loadMostRecentChat();
      mainTextInputRef.current?.focus?.();
    },
    [loadMostRecentChat],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      let foundLaterUserInput = false;
      for (let i = index + 1; i < state.perplexityHistory.length; i++) {
        if (state.perplexityHistory[i].message.role === "user") {
          foundLaterUserInput = true;
          break;
        }
      }
      return !foundLaterUserInput;
    },
    [state.perplexityHistory],
  );

  return (
    <>
      <TopGuiDiv ref={topGuiDivRef} onScroll={handleScroll}>
        <div className="mx-2">
          <div className="pl-2 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold mb-2">PearAI Search</h1>{" "}
              <Badge variant="outline" className="pl-0">
                Beta (Powered by Perplexity)
              </Badge>
            </div>
            <div className="flex items-center mt-0 justify-between pr-1">
              <p className="text-sm text-gray-400 m-0">
                Ask for anything. We'll retrieve up-to-date information in
                real-time on the web. Search uses less credits than PearAI Chat,
                and is perfect for documentation lookups.
              </p>
              {state.perplexityHistory.length > 0 ? (
                <div className="mt-0">
                  <NewSessionButton
                    onClick={() => {
                      saveSession();
                    }}
                    className="mr-auto"
                  >
                    Clear chat
                  </NewSessionButton>
                </div>
              ) : null}
            </div>
          </div>
          <StepsDiv>
            {state.perplexityHistory.map((item, index: number) => (
              <Fragment key={index}>
                <ErrorBoundary
                  FallbackComponent={fallbackRender}
                  onReset={() => {
                    dispatch(
                      newSession({ session: undefined, source: "perplexity" }),
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
                          "perplexity",
                        );
                      }}
                      isLastUserInput={isLastUserInput(index)}
                      isMainInput={false}
                      editorState={item.editorState}
                      contextItems={item.contextItems}
                      source="perplexity"
                    ></ContinueInputBox>
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
                            index === sessionState.perplexityHistory.length - 1
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
                              state.perplexityHistory[index - 1].editorState,
                              state.perplexityHistory[index - 1].modifiers ??
                                defaultInputModifiers,
                              ideMessenger,
                              index - 1,
                              "perplexity",
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
                                source: "perplexity",
                              }),
                            );
                          }}
                          modelTitle={
                            item.promptLogs?.[0]?.completionOptions?.model ?? ""
                          }
                          source="perplexity"
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
            source="perplexity"
          ></ContinueInputBox>
          {active ? (
            <>
              <br />
              <br />
            </>
          ) : state.perplexityHistory.length > 0 ? (
            <div className="mt-2">
              <NewSessionButton
                onClick={() => {
                  saveSession();
                }}
                className="mr-auto"
              >
                Clear chat
              </NewSessionButton>
            </div>
          ) : (
            <>
              {" "}
              {/** TODO: Prevent removing tutorial card for now. Set to showerPerplexityTutorialCard later */}
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
            dispatch(setPerplexityInactive());
            if (
              state.perplexityHistory[state.perplexityHistory.length - 1]
                ?.message.content.length === 0
            ) {
              dispatch(clearLastResponse("perplexity"));
            }
          }}
        >
          {getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      )}
    </>
  );
}

const tutorialContent = {
  goodFor: "searching documentation, debugging errors, quick look-ups",
  notGoodFor: "direct feature implementations (use PearAI chat instead)",
  example: {
    text: '"what\'s new in the latest python version?"',
    copyText: "what's new in the latest python version?",
  },
};

export default PerplexityGUI;

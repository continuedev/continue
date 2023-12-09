import {
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { constructMessages } from "core/llm/constructMessages";
import { ChatHistoryItem, ChatMessage } from "core/llm/types";
import { usePostHog } from "posthog-js/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
} from "../components";
import FTCDialog from "../components/dialogs/FTCDialog";
import ErrorStepContainer from "../components/gui/ErrorStepContainer";
import StepContainer from "../components/gui/StepContainer";
import TimelineItem from "../components/gui/TimelineItem";
import ComboBox from "../components/mainInput/ComboBox";
import useHistory from "../hooks/useHistory";
import useModels from "../hooks/useModels";
import { setTakenActionTrue } from "../redux/slices/miscSlice";
import {
  newSession,
  resubmitAtIndex,
  setInactive,
  streamUpdate,
  submitMessage,
} from "../redux/slices/stateSlice";
import {
  setBottomMessage,
  setDialogEntryOn,
  setDialogMessage,
  setDisplayBottomMessageOnBottom,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { RootStore } from "../redux/store";
import { isMetaEquivalentKeyPressed } from "../util";

const TopGuiDiv = styled.div`
  overflow-y: scroll;

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }

  height: 100%;
`;

const StopButton = styled.div`
  width: fit-content;
  margin-right: auto;
  margin-left: auto;

  font-size: 12px;

  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  color: ${lightGray};

  cursor: pointer;
`;

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  &::before {
    content: "";
    position: absolute;
    height: calc(100% - 12px);
    border-left: 2px solid ${lightGray};
    left: 28px;
    z-index: 0;
    bottom: 12px;
  }
`;

function fallbackRender({ error, resetErrorBoundary }) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div
      role="alert"
      className="px-2"
      style={{ backgroundColor: vscBackground }}
    >
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>

      <div className="text-center">
        <Button onClick={resetErrorBoundary}>Restart</Button>
      </div>
    </div>
  );
}

interface GUIProps {
  firstObservation?: any;
}

function GUI(props: GUIProps) {
  // #region Hooks
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // #endregion

  // #region Selectors
  const sessionState = useSelector((state: RootStore) => state.state);
  const workspacePaths = (window as any).workspacePaths || [];

  const { defaultModel } = useModels();

  const sessionTitle = useSelector((state: RootStore) => state.state.title);
  const active = useSelector((state: RootStore) => state.state.active);

  // #endregion

  // #region State
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowLoading(true);
    }, 5000);
  }, []);

  // #endregion

  // #region Refs
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const topGuiDivRef = useRef<HTMLDivElement>(null);
  // #endregion

  // #region Effects

  // Set displayBottomMessageOnBottom
  const aboveComboBoxDivRef = useRef<HTMLDivElement>(null);
  const bottomMessage = useSelector(
    (state: RootStore) => state.uiState.bottomMessage
  );
  const takenAction = useSelector((state: RootStore) => state.misc.takenAction);
  useEffect(() => {
    if (!aboveComboBoxDivRef.current) return;
    dispatch(
      setDisplayBottomMessageOnBottom(
        aboveComboBoxDivRef.current.getBoundingClientRect().top <
          window.innerHeight / 2
      )
    );
  }, [bottomMessage, aboveComboBoxDivRef.current]);

  const [userScrolledAwayFromBottom, setUserScrolledAwayFromBottom] =
    useState<boolean>(false);

  const state = useSelector((state: RootStore) => state.state);

  useEffect(() => {
    const handleScroll = () => {
      // Scroll only if user is within 200 pixels of the bottom of the window.
      const edgeOffset = -25;
      const scrollPosition = topGuiDivRef.current?.scrollTop || 0;
      const scrollHeight = topGuiDivRef.current?.scrollHeight || 0;
      const clientHeight = window.innerHeight || 0;

      if (scrollPosition + clientHeight + edgeOffset >= scrollHeight) {
        setUserScrolledAwayFromBottom(false);
      } else {
        setUserScrolledAwayFromBottom(true);
      }
    };

    topGuiDivRef.current?.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [topGuiDivRef.current]);

  useLayoutEffect(() => {
    if (userScrolledAwayFromBottom) return;

    topGuiDivRef.current?.scrollTo({
      top: topGuiDivRef.current?.scrollHeight,
      behavior: "instant" as any,
    });
  }, [topGuiDivRef.current?.scrollHeight, sessionState.history]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey
      ) {
        dispatch(setInactive());
      } else if (e.key === "Escape") {
        dispatch(setBottomMessage(undefined));
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [active]);

  // #endregion

  const sendInput = useCallback(
    (input: string) => {
      if (
        defaultModel.providerName === "openai-free-trial" &&
        defaultModel?.apiKey === "" &&
        (!input.startsWith("/") || input.startsWith("/edit"))
      ) {
        const ftc = localStorage.getItem("ftc");
        if (ftc) {
          const u = parseInt(ftc);
          localStorage.setItem("ftc", (u + 1).toString());

          if (u >= 250) {
            dispatch(setShowDialog(true));
            dispatch(setDialogMessage(<FTCDialog />));
            posthog?.capture("ftc_reached");
            return;
          }
        } else {
          localStorage.setItem("ftc", "1");
        }
      }

      const message: ChatMessage = {
        role: "user",
        content: input,
      };
      const historyItem: ChatHistoryItem = {
        message,
        contextItems: state.contextItems,
      };

      const messages = constructMessages([...state.history, historyItem]);
      dispatch(submitMessage(message));

      (async () => {
        for await (const update of defaultModel.streamChat(messages)) {
          dispatch(streamUpdate(update.content));
        }
        dispatch(setInactive());
      })();

      // Increment localstorage counter for popup
      const counter = localStorage.getItem("mainTextEntryCounter");
      if (counter) {
        let currentCount = parseInt(counter);
        localStorage.setItem(
          "mainTextEntryCounter",
          (currentCount + 1).toString()
        );
        if (currentCount === 300) {
          dispatch(
            setDialogMessage(
              <div className="text-center p-4">
                👋 Thanks for using Continue. We are a beta product and love
                working closely with our first users. If you're interested in
                speaking, enter your name and email. We won't use this
                information for anything other than reaching out.
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
                        <div className="text-center p-4">
                          Thanks! We'll be in touch soon.
                        </div>
                      )
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
              </div>
            )
          );
          dispatch(setDialogEntryOn(false));
          dispatch(setShowDialog(true));
        }
      } else {
        localStorage.setItem("mainTextEntryCounter", "1");
      }
    },
    [sessionState.history, sessionState.contextItems, defaultModel, state]
  );

  const { saveSession } = useHistory();

  useEffect(() => {
    const handler = (event: any) => {
      if (event.data.type === "newSession") {
        saveSession();
        dispatch(newSession());
        mainTextInputRef.current?.focus?.();
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [saveSession]);

  useEffect(() => {
    const eventListener = (event: any) => {
      if (event.data.type === "userInput") {
        sendInput(event.data.input);
      }
    };
    window.addEventListener("message", eventListener);
    return () => window.removeEventListener("message", eventListener);
  }, [sendInput]);

  const onMainTextInput = (event?: any) => {
    console.log("onMainTextInput");
    dispatch(setTakenActionTrue(null));
    if (mainTextInputRef.current) {
      let input = (mainTextInputRef.current as any).inputValue;

      if (input.trim() === "") return;

      if (input.startsWith("#") && (input.length === 7 || input.length === 4)) {
        localStorage.setItem("continueButtonColor", input);
        (mainTextInputRef.current as any).setInputValue("");
        return;
      }

      // cmd+enter to /codebase
      if (event && isMetaEquivalentKeyPressed(event)) {
        input = `/codebase ${input}`;
      }
      (mainTextInputRef.current as any).setInputValue("");

      sendInput(input);
    }
  };

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      let foundLaterUserInput = false;
      for (let i = index + 1; i < state.history.length; i++) {
        if (state.history[i].message.role === "user") {
          foundLaterUserInput = true;
          break;
        }
      }
      return !foundLaterUserInput;
    },
    [state.history]
  );

  useEffect(() => {
    if (sessionTitle) {
      setSessionTitleInput(sessionTitle);
    }
  }, [sessionTitle]);

  const [sessionTitleInput, setSessionTitleInput] = useState<string>(
    sessionTitle || "New Session"
  );

  return (
    <TopGuiDiv
      ref={topGuiDivRef}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.ctrlKey) {
          onMainTextInput();
        }
      }}
    >
      <div className="max-w-3xl m-auto">
        <StepsDiv>
          {state.history.map((item, index: number) => {
            return (
              <Fragment key={index}>
                <ErrorBoundary
                  FallbackComponent={fallbackRender}
                  onReset={() => {
                    dispatch(newSession());
                  }}
                >
                  {item.message.role === "user" ? (
                    <ComboBox
                      isMainInput={false}
                      value={item.message.content}
                      active={active && isLastUserInput(index)}
                      onEnter={(e, value) => {
                        if (value) {
                          dispatch(resubmitAtIndex({ index, content: value }));

                          // TODO: Call the LLM
                        }
                        e?.stopPropagation();
                        e?.preventDefault();
                      }}
                      isToggleOpen={
                        typeof stepsOpen[index] === "undefined"
                          ? true
                          : stepsOpen[index]!
                      }
                      index={index}
                    />
                  ) : (
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
                      {false ? ( // Most of these falses were previously (step.error)
                        <ErrorStepContainer
                          onClose={() => {}}
                          error={undefined}
                          onDelete={() => {}}
                        />
                      ) : (
                        <StepContainer
                          index={index}
                          isLast={index === sessionState.history.length - 1}
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
                          onRetry={() => {}}
                          onDelete={() => {}}
                        />
                      )}
                    </TimelineItem>
                  )}
                  {/* <div className="h-2"></div> */}
                </ErrorBoundary>
              </Fragment>
            );
          })}
        </StepsDiv>

        <div ref={aboveComboBoxDivRef} />
        {active ? (
          <StopButton
            onClick={() => {
              dispatch(setInactive());
            }}
          >
            ⌘ ⌫ Cancel
          </StopButton>
        ) : (
          <ComboBox
            active={false}
            isMainInput={true}
            ref={mainTextInputRef}
            onEnter={(e, _) => {
              onMainTextInput(e);
              e?.stopPropagation();
              e?.preventDefault();
            }}
            onInputValueChange={() => {}}
            onToggleAddContext={() => {}}
          />
        )}
      </div>
    </TopGuiDiv>
  );
}

export default GUI;

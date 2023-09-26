import styled from "styled-components";
import { TextInput, defaultBorderRadius, lightGray } from "../components";
import { FullState } from "../../../schema/FullState";
import {
  useEffect,
  useRef,
  useState,
  useContext,
  useLayoutEffect,
  useCallback,
} from "react";
import { HistoryNode } from "../../../schema/HistoryNode";
import StepContainer from "../components/StepContainer";
import { GUIClientContext } from "../App";
import ComboBox from "../components/ComboBox";
import { usePostHog } from "posthog-js/react";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { postVscMessage } from "../vscode";
import UserInputContainer from "../components/UserInputContainer";
import { isMetaEquivalentKeyPressed } from "../util";
import {
  setBottomMessage,
  setDialogEntryOn,
  setDialogMessage,
  setDisplayBottomMessageOnBottom,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import RingLoader from "../components/RingLoader";
import {
  setServerState,
  temporarilyClearSession,
  temporarilyPushToUserInputQueue,
} from "../redux/slices/serverStateReducer";
import TimelineItem from "../components/TimelineItem";
import ErrorStepContainer from "../components/ErrorStepContainer";
import {
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import FTCDialog from "../components/dialogs/FTCDialog";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import { useNavigate } from "react-router-dom";
import SuggestionsArea from "../components/Suggestions";

const TopGuiDiv = styled.div`
  overflow-y: scroll;

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TitleTextInput = styled(TextInput)`
  border: none;
  outline: none;

  font-size: 16px;
  font-weight: bold;
  margin: 0;
  margin-right: 8px;
  padding-top: 6px;
  padding-bottom: 6px;

  &:focus {
    outline: none;
  }
`;

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;
  padding-left: 8px;
  padding-right: 8px;

  & > * {
    z-index: 1;
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

const UserInputQueueItem = styled.div`
  border-radius: ${defaultBorderRadius};
  color: gray;
  padding: 8px;
  margin: 8px;
  text-align: center;
`;

const GUIHeaderDiv = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px;
  padding-left: 8px;
  padding-right: 8px;
  border-bottom: 0.5px solid ${lightGray};
`;

interface GUIProps {
  firstObservation?: any;
}

function GUI(props: GUIProps) {
  // #region Hooks
  const client = useContext(GUIClientContext);
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // #endregion

  // #region Selectors
  const history = useSelector((state: RootStore) => state.serverState.history);
  const defaultModel = useSelector(
    (state: RootStore) => (state.serverState.config as any).models?.default
  );
  const user_input_queue = useSelector(
    (state: RootStore) => state.serverState.user_input_queue
  );

  const sessionTitle = useSelector(
    (state: RootStore) => state.serverState.session_info?.title
  );

  // #endregion

  // #region State
  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const [waitingForClient, setWaitingForClient] = useState(true);
  const [showLoading, setShowLoading] = useState(false);

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

    topGuiDivRef.current?.addEventListener("wheel", handleScroll);

    return () => {
      window.removeEventListener("wheel", handleScroll);
    };
  }, [topGuiDivRef.current]);

  useLayoutEffect(() => {
    if (userScrolledAwayFromBottom) return;

    topGuiDivRef.current?.scrollTo({
      top: topGuiDivRef.current?.scrollHeight,
      behavior: "instant" as any,
    });
  }, [topGuiDivRef.current?.scrollHeight, history.timeline]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey &&
        typeof history?.current_index !== "undefined" &&
        history.timeline[history.current_index]?.active
      ) {
        client?.deleteAtIndex(history.current_index);
      } else if (e.key === "Escape") {
        dispatch(setBottomMessage(undefined));
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [client, history]);

  useEffect(() => {
    client?.onStateUpdate((state: FullState) => {
      const waitingForSteps =
        state.active &&
        state.history.current_index < state.history.timeline.length &&
        state.history.timeline[state.history.current_index] &&
        state.history.timeline[
          state.history.current_index
        ].step.description?.trim() === "";

      dispatch(setServerState(state));

      setWaitingForSteps(waitingForSteps);
      setStepsOpen((prev) => {
        const nextStepsOpen = [...prev];
        for (
          let i = nextStepsOpen.length;
          i < state.history.timeline.length;
          i++
        ) {
          nextStepsOpen.push(undefined);
        }
        return nextStepsOpen;
      });
    });
  }, [client]);

  // #endregion

  useEffect(() => {
    if (client && waitingForClient) {
      setWaitingForClient(false);
      for (const input of user_input_queue) {
        client.sendMainInput(input);
      }
    }
  }, [client, user_input_queue, waitingForClient]);

  const onMainTextInput = (event?: any) => {
    if (mainTextInputRef.current) {
      let input = (mainTextInputRef.current as any).inputValue;

      if (input.trim() === "") return;

      if (input.startsWith("#") && (input.length === 7 || input.length === 4)) {
        localStorage.setItem("continueButtonColor", input);
        (mainTextInputRef.current as any).setInputValue("");
        return;
      }

      // cmd+enter to /edit
      if (event && isMetaEquivalentKeyPressed(event)) {
        input = `/edit ${input}`;
      }
      (mainTextInputRef.current as any).setInputValue("");
      if (!client) {
        dispatch(temporarilyPushToUserInputQueue(input));
        return;
      }

      if (
        defaultModel.class_name === "OpenAIFreeTrial" &&
        defaultModel.api_key === "" &&
        (!input.startsWith("/") || input.startsWith("/edit"))
      ) {
        const ftc = localStorage.getItem("ftc");
        if (ftc) {
          const u = parseInt(ftc);
          localStorage.setItem("ftc", (u + 1).toString());

          if (u >= 250) {
            dispatch(setShowDialog(true));
            dispatch(setDialogMessage(<FTCDialog />));
            return;
          }
        } else {
          localStorage.setItem("ftc", "1");
        }
      }

      setWaitingForSteps(true);

      if (
        history &&
        history.current_index >= 0 &&
        history.current_index < history.timeline.length
      ) {
        if (
          history.timeline[history.current_index]?.step.name ===
          "Waiting for user input"
        ) {
          if (input.trim() === "") return;
          onStepUserInput(input, history!.current_index);
          return;
        } else if (
          history.timeline[history.current_index]?.step.name ===
          "Waiting for user confirmation"
        ) {
          onStepUserInput("ok", history!.current_index);
          return;
        }
      }

      client.sendMainInput(input);
      dispatch(temporarilyPushToUserInputQueue(input));

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
    }
  };

  const onStepUserInput = (input: string, index: number) => {
    if (!client) return;
    client.sendStepUserInput(input, index);
  };

  const getStepsInUserInputGroup = useCallback(
    (index: number): number[] => {
      // index is the index in the entire timeline, hidden steps included
      const stepsInUserInputGroup: number[] = [];

      // First find the closest above UserInputStep
      let userInputIndex = -1;
      for (let i = index; i >= 0; i--) {
        if (
          history?.timeline.length > i &&
          history.timeline[i].step.name === "User Input" &&
          history.timeline[i].step.hide === false
        ) {
          stepsInUserInputGroup.push(i);
          userInputIndex = i;
          break;
        }
      }
      if (stepsInUserInputGroup.length === 0) return [];

      for (let i = userInputIndex + 1; i < history?.timeline.length; i++) {
        if (
          history?.timeline.length > i &&
          history.timeline[i].step.name === "User Input" &&
          history.timeline[i].step.hide === false
        ) {
          break;
        }
        stepsInUserInputGroup.push(i);
      }
      return stepsInUserInputGroup;
    },
    [history.timeline]
  );

  const onToggleAtIndex = useCallback(
    (index: number) => {
      // Check if all steps after the User Input are closed
      const groupIndices = getStepsInUserInputGroup(index);
      const userInputIndex = groupIndices[0];
      setStepsOpen((prev) => {
        const nextStepsOpen = [...prev];
        nextStepsOpen[index] = !nextStepsOpen[index];
        const allStepsAfterUserInputAreClosed = !groupIndices.some(
          (i, j) => j > 0 && nextStepsOpen[i]
        );
        if (allStepsAfterUserInputAreClosed) {
          nextStepsOpen[userInputIndex] = false;
        } else {
          const allStepsAfterUserInputAreOpen = !groupIndices.some(
            (i, j) => j > 0 && !nextStepsOpen[i]
          );
          if (allStepsAfterUserInputAreOpen) {
            nextStepsOpen[userInputIndex] = true;
          }
        }

        return nextStepsOpen;
      });
    },
    [getStepsInUserInputGroup]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true);
    }, 3000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

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
      <GUIHeaderDiv>
        <TitleTextInput
          onClick={(e) => {
            // Select all text
            (e.target as any).setSelectionRange(
              0,
              (e.target as any).value.length
            );
          }}
          value={sessionTitleInput}
          onChange={(e) => setSessionTitleInput(e.target.value)}
          onBlur={(e) => {
            if (
              e.target.value === sessionTitle ||
              (typeof sessionTitle === "undefined" &&
                e.target.value === "New Session")
            )
              return;
            client?.setCurrentSessionTitle(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as any).blur();
            } else if (e.key === "Escape") {
              setSessionTitleInput(sessionTitle || "New Session");
              (e.target as any).blur();
            }
          }}
        />
        <div className="flex gap-2">
          {history.timeline.filter((n) => !n.step.hide).length > 0 && (
            <HeaderButtonWithText
              onClick={() => {
                if (history.timeline.filter((n) => !n.step.hide).length > 0) {
                  dispatch(temporarilyClearSession(false));
                  client?.loadSession(undefined);
                }
              }}
              text="New Session (⌥⌘N)"
            >
              <PlusIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
          )}

          <HeaderButtonWithText
            onClick={() => {
              navigate("/history");
            }}
            text="History"
          >
            <FolderIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        </div>
      </GUIHeaderDiv>
      {showLoading && typeof client === "undefined" && (
        <>
          <RingLoader />
          <p
            style={{
              textAlign: "center",
              margin: "0px",
              fontSize: "14px",
            }}
          >
            Continue Server Starting
          </p>
          <div className="flex mx-8 my-2">
            <p
              style={{
                margin: "auto",
                textAlign: "center",
                marginTop: "4px",
                fontSize: "12px",
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              <u>
                <a
                  style={{ color: "inherit" }}
                  href="https://continue.dev/docs/troubleshooting"
                  target="_blank"
                >
                  Troubleshooting help
                </a>
              </u>
            </p>
            <p
              style={{
                margin: "auto",
                textAlign: "center",
                marginTop: "4px",
                fontSize: "12px",
                cursor: "pointer",
                opacity: 0.7,
              }}
              onClick={() => {
                postVscMessage("toggleDevTools", {});
              }}
            >
              <u>View logs</u>
            </p>
            <p
              style={{
                margin: "auto",
                textAlign: "center",
                marginTop: "4px",
                fontSize: "12px",
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              <u>
                <a
                  style={{ color: "inherit" }}
                  href="https://continue.dev/docs/walkthroughs/manually-run-continue#recommended-use-the-continuedev-pypi-package"
                  target="_blank"
                >
                  Manually start server
                </a>
              </u>
            </p>
          </div>
        </>
      )}
      <br />
      <SuggestionsArea
        onClick={(textInput) => {
          client?.sendMainInput(textInput);
        }}
      />
      <StepsDiv>
        {history?.timeline.map((node: HistoryNode, index: number) => {
          if (node.step.hide) return null;
          return (
            <>
              {node.step.name === "User Input" ? (
                node.step.hide || (
                  <UserInputContainer
                    active={getStepsInUserInputGroup(index).some((i) => {
                      return history.timeline[i].active;
                    })}
                    groupIndices={getStepsInUserInputGroup(index)}
                    onToggle={(isOpen: boolean) => {
                      // Collapse all steps in the section
                      setStepsOpen((prev) => {
                        const nextStepsOpen = [...prev];
                        getStepsInUserInputGroup(index).forEach((i) => {
                          nextStepsOpen[i] = isOpen;
                        });
                        return nextStepsOpen;
                      });
                    }}
                    onToggleAll={(isOpen: boolean) => {
                      // Collapse _all_ steps
                      setStepsOpen((prev) => {
                        return prev.map((_) => isOpen);
                      });
                    }}
                    isToggleOpen={
                      typeof stepsOpen[index] === "undefined"
                        ? true
                        : stepsOpen[index]!
                    }
                    index={index}
                    onDelete={() => {
                      // Delete the input and all steps until the next user input
                      getStepsInUserInputGroup(index).forEach((i) => {
                        client?.deleteAtIndex(i);
                      });
                    }}
                    historyNode={node}
                  >
                    {node.step.description as string}
                  </UserInputContainer>
                )
              ) : (
                <TimelineItem
                  historyNode={node}
                  iconElement={
                    node.step.class_name === "DefaultModelEditCodeStep" ? (
                      <CodeBracketSquareIcon width="16px" height="16px" />
                    ) : node.observation?.error ? (
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
                      ? node.observation?.error
                        ? false
                        : true
                      : stepsOpen[index]!
                  }
                  onToggle={() => onToggleAtIndex(index)}
                >
                  {node.observation?.error ? (
                    <ErrorStepContainer
                      onClose={() => onToggleAtIndex(index)}
                      historyNode={node}
                      onDelete={() => client?.deleteAtIndex(index)}
                    />
                  ) : (
                    <StepContainer
                      index={index}
                      isLast={index === history.timeline.length - 1}
                      isFirst={index === 0}
                      open={
                        typeof stepsOpen[index] === "undefined"
                          ? true
                          : stepsOpen[index]!
                      }
                      key={index}
                      onUserInput={(input: string) => {
                        onStepUserInput(input, index);
                      }}
                      inFuture={index > history?.current_index}
                      historyNode={node}
                      onReverse={() => {
                        client?.reverseToIndex(index);
                      }}
                      onRetry={() => {
                        client?.retryAtIndex(index);
                        setWaitingForSteps(true);
                      }}
                      onDelete={() => {
                        client?.deleteAtIndex(index);
                      }}
                      noUserInputParent={
                        getStepsInUserInputGroup(index).length === 0
                      }
                    />
                  )}
                </TimelineItem>
              )}
              {/* <div className="h-2"></div> */}
            </>
          );
        })}
      </StepsDiv>

      <div>
        {user_input_queue?.map?.((input) => {
          return <UserInputQueueItem>{input}</UserInputQueueItem>;
        })}
      </div>

      <div ref={aboveComboBoxDivRef} />
      <ComboBox
        ref={mainTextInputRef}
        onEnter={(e) => {
          onMainTextInput(e);
          e?.stopPropagation();
          e?.preventDefault();
        }}
        onInputValueChange={() => {}}
        onToggleAddContext={() => {
          client?.toggleAddingHighlightedCode();
        }}
      />
    </TopGuiDiv>
  );
}

export default GUI;

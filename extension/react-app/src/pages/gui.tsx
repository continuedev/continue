import styled from "styled-components";
import { defaultBorderRadius, lightGray } from "../components";
import ContinueButton from "../components/ContinueButton";
import { FullState } from "../../../schema/FullState";
import {
  useEffect,
  useRef,
  useState,
  useContext,
  useLayoutEffect,
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
import FreeTrialLimitReachedDialog from "../components/dialogs/FreeTrialLimitReachedDialog";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import { useNavigate } from "react-router-dom";

const TopGuiDiv = styled.div`
  overflow-y: scroll;

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
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
    height: calc(100% - 24px);
    border-left: 2px solid ${lightGray};
    left: 28px;
    z-index: 0;
    bottom: 24px;
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
  padding: 8px;
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
    (state: RootStore) =>
      (state.serverState.config as any).models?.default?.class_name
  );
  const user_input_queue = useSelector(
    (state: RootStore) => state.serverState.user_input_queue
  );
  const adding_highlighted_code = useSelector(
    (state: RootStore) => state.serverState.adding_highlighted_code
  );
  const selected_context_items = useSelector(
    (state: RootStore) => state.serverState.selected_context_items
  );
  const sessionTitle = useSelector(
    (state: RootStore) => state.serverState.session_info?.title
  );

  // #endregion

  // #region State
  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [availableSlashCommands, setAvailableSlashCommands] = useState<
    { name: string; description: string }[]
  >([]);
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
      setAvailableSlashCommands(
        state.slash_commands.map((c: any) => {
          return {
            name: `/${c.name}`,
            description: c.description,
          };
        })
      );
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
      if (isMetaEquivalentKeyPressed(event)) {
        input = `/edit ${input}`;
      }
      (mainTextInputRef.current as any).setInputValue("");
      if (!client) {
        dispatch(temporarilyPushToUserInputQueue(input));
        return;
      }

      // Increment localstorage counter for usage of free trial
      if (
        defaultModel === "OpenAIFreeTrial" &&
        (!input.startsWith("/") || input.startsWith("/edit"))
      ) {
        const freeTrialCounter = localStorage.getItem("freeTrialCounter");
        if (freeTrialCounter) {
          const usages = parseInt(freeTrialCounter);
          localStorage.setItem("freeTrialCounter", (usages + 1).toString());

          if (usages >= 250) {
            console.log("Free trial limit reached");
            dispatch(setShowDialog(true));
            dispatch(setDialogMessage(<FreeTrialLimitReachedDialog />));
            return;
          }
        } else {
          localStorage.setItem("freeTrialCounter", "1");
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
        if (currentCount === -300) {
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

  const onToggleAtIndex = (index: number) => {
    // Check if all steps after the User Input are closed
    let userInputIndex = -1;
    for (let i = index; i >= 0; i--) {
      if (
        history?.timeline.length > i &&
        history.timeline[i].step.name === "User Input"
      ) {
        userInputIndex = i;
        break;
      }
    }
    if (userInputIndex > 0) {
      let allStepsAfterUserInputAreClosed = true;
      for (let i = userInputIndex + 1; i < stepsOpen.length; i++) {
        if (i === index) continue;
        if (
          history?.timeline.length > i &&
          history.timeline[i].step.name === "User Input"
        ) {
          break;
        }
        if (stepsOpen[i]) {
          allStepsAfterUserInputAreClosed = false;
          break;
        }
      }
      if (allStepsAfterUserInputAreClosed) {
        setStepsOpen((prev) => {
          const nextStepsOpen = [...prev];
          nextStepsOpen[userInputIndex] = false;
          return nextStepsOpen;
        });
      }
    }

    setStepsOpen((prev) => {
      const nextStepsOpen = [...prev];
      nextStepsOpen[index] = !nextStepsOpen[index];
      return nextStepsOpen;
    });
  };

  const getStepsInUserInputGroup = (index: number): number[] => {
    const stepsInUserInputGroup: number[] = [];
    for (let i = index; i >= 0; i--) {
      if (
        history?.timeline.length > i &&
        history.timeline[i].step.name === "User Input" &&
        history.timeline[i].step.hide === false
      ) {
        stepsInUserInputGroup.push(i);
      }
    }
    if (stepsInUserInputGroup.length === 0) return [];

    for (let i = index + 1; i < history?.timeline.length; i++) {
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
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true);
    }, 3000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

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
        <h3 className="text-lg font-bold m-0">
          {sessionTitle || "New Session"}
        </h3>
        <div className="flex">
          {history.timeline.filter((n) => !n.step.hide).length > 0 && (
            <HeaderButtonWithText
              onClick={() => {
                if (history.timeline.filter((n) => !n.step.hide).length > 0) {
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
                      // Collapse all steps in the section
                      setStepsOpen((prev) => {
                        const nextStepsOpen = [...prev];
                        getStepsInUserInputGroup(index).forEach((i) => {
                          nextStepsOpen[i] = isOpen;
                        });
                        return nextStepsOpen;
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
        items={availableSlashCommands}
        selectedContextItems={selected_context_items}
        onToggleAddContext={() => {
          client?.toggleAddingHighlightedCode();
        }}
        addingHighlightedCode={adding_highlighted_code}
      />
    </TopGuiDiv>
  );
}

export default GUI;

import styled from "styled-components";
import {
  defaultBorderRadius,
  secondaryDark,
  vscForeground,
} from "../components";
import Loader from "../components/Loader";
import ContinueButton from "../components/ContinueButton";
import { ContextItem, FullState } from "../../../schema/FullState";
import { useCallback, useEffect, useRef, useState, useContext } from "react";
import { History } from "../../../schema/History";
import { HistoryNode } from "../../../schema/HistoryNode";
import StepContainer from "../components/StepContainer";
import { GUIClientContext } from "../App";
import {
  BookOpenIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import ComboBox from "../components/ComboBox";
import TextDialog from "../components/TextDialog";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import ReactSwitch from "react-switch";
import { usePostHog } from "posthog-js/react";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { postVscMessage } from "../vscode";
import UserInputContainer from "../components/UserInputContainer";
import Onboarding from "../components/Onboarding";
import { isMetaEquivalentKeyPressed } from "../util";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
} from "../redux/slices/uiStateSlice";
import RingLoader from "../components/RingLoader";

const TopGUIDiv = styled.div`
  overflow: hidden;
`;

const BottomMessageDiv = styled.div<{ displayOnBottom: boolean }>`
  position: fixed;
  bottom: ${(props) => (props.displayOnBottom ? "50px" : undefined)};
  top: ${(props) => (props.displayOnBottom ? undefined : "50px")};
  left: 0;
  right: 0;
  margin: 8px;
  margin-top: 0;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  border-radius: ${defaultBorderRadius};
  padding: 12px;
  z-index: 100;
  box-shadow: 0px 0px 2px 0px ${vscForeground};
  max-height: 50vh;
  overflow: scroll;
`;

const UserInputQueueItem = styled.div`
  border-radius: ${defaultBorderRadius};
  color: gray;
  padding: 8px;
  margin: 8px;
  text-align: center;
`;

const Footer = styled.footer<{ dataSwitchChecked: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: right;
  padding: 8px;
  align-items: center;
  margin-top: 8px;
  border-top: 0.1px solid gray;
  background-color: ${(props) =>
    props.dataSwitchChecked ? "#12887a33" : "transparent"};
`;

interface GUIProps {
  firstObservation?: any;
}

function GUI(props: GUIProps) {
  const client = useContext(GUIClientContext);
  const posthog = usePostHog();

  const vscMachineId = useSelector(
    (state: RootStore) => state.config.vscMachineId
  );
  const [dataSwitchChecked, setDataSwitchChecked] = useState(false);
  const dataSwitchOn = useSelector(
    (state: RootStore) => state.config.dataSwitchOn
  );

  useEffect(() => {
    if (typeof dataSwitchOn !== "undefined") {
      setDataSwitchChecked(dataSwitchOn);
    }
  }, [dataSwitchOn]);

  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [userInputQueue, setUserInputQueue] = useState<string[]>([]);
  const [addingHighlightedCode, setAddingHighlightedCode] = useState(false);
  const [selectedContextItems, setSelectedContextItems] = useState<
    ContextItem[]
  >([]);
  const [availableSlashCommands, setAvailableSlashCommands] = useState<
    { name: string; description: string }[]
  >([]);
  const [stepsOpen, setStepsOpen] = useState<boolean[]>([
    true,
    true,
    true,
    true,
  ]);
  const [history, setHistory] = useState<History | undefined>({
    timeline: [
      {
        step: {
          name: "Welcome to Continue",
          hide: false,
          description: `- Highlight code section and ask a question or give instructions
- Use \`cmd+m\` (Mac) / \`ctrl+m\` (Windows) to open Continue
- Use \`/help\` to ask questions about how to use Continue`,
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
          message: "",
        },
        depth: 0,
        deleted: false,
        active: false,
      },
    ],
    current_index: 3,
  } as any);

  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackDialogMessage, setFeedbackDialogMessage] = useState<
    string | JSX.Element
  >("");
  const [feedbackEntryOn, setFeedbackEntryOn] = useState(true);

  const dispatch = useDispatch();
  const bottomMessage = useSelector(
    (state: RootStore) => state.uiState.bottomMessage
  );

  const [displayBottomMessageOnBottom, setDisplayBottomMessageOnBottom] =
    useState<boolean>(true);
  const mainTextInputRef = useRef<HTMLInputElement>(null);

  const aboveComboBoxDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aboveComboBoxDivRef.current) return;
    if (
      aboveComboBoxDivRef.current.getBoundingClientRect().top >
      window.innerHeight / 2
    ) {
      setDisplayBottomMessageOnBottom(false);
    } else {
      setDisplayBottomMessageOnBottom(true);
    }
  }, [bottomMessage, aboveComboBoxDivRef.current]);

  const topGuiDivRef = useRef<HTMLDivElement>(null);

  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const scrollToBottom = useCallback(() => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    // Debounced smooth scroll to bottom of screen
    if (topGuiDivRef.current) {
      const timeout = setTimeout(() => {
        window.scrollTo({
          top: topGuiDivRef.current!.offsetHeight,
          behavior: "smooth",
        });
      }, 200);
      setScrollTimeout(timeout);
    }
  }, [topGuiDivRef.current, scrollTimeout]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
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
      // Scroll only if user is at very bottom of the window.
      const shouldScrollToBottom =
        topGuiDivRef.current &&
        topGuiDivRef.current?.offsetHeight - window.scrollY < 100;

      const waitingForSteps =
        state.active &&
        state.history.current_index < state.history.timeline.length &&
        state.history.timeline[state.history.current_index] &&
        state.history.timeline[
          state.history.current_index
        ].step.description?.trim() === "";

      setWaitingForSteps(waitingForSteps);
      setHistory(state.history);
      setSelectedContextItems(state.selected_context_items || []);
      setUserInputQueue(state.user_input_queue);
      setAddingHighlightedCode(state.adding_highlighted_code);
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
          nextStepsOpen.push(true);
        }
        return nextStepsOpen;
      });

      if (shouldScrollToBottom) {
        scrollToBottom();
      }
    });
  }, [client]);

  useEffect(() => {
    scrollToBottom();
  }, [waitingForSteps]);

  const [waitingForClient, setWaitingForClient] = useState(true);
  useEffect(() => {
    if (client && waitingForClient) {
      setWaitingForClient(false);
      for (const input of userInputQueue) {
        client.sendMainInput(input);
      }
    }
  }, [client, userInputQueue, waitingForClient]);

  const onMainTextInput = (event?: any) => {
    if (mainTextInputRef.current) {
      let input = (mainTextInputRef.current as any).inputValue;
      // cmd+enter to /edit
      if (isMetaEquivalentKeyPressed(event)) {
        input = `/edit ${input}`;
      }
      (mainTextInputRef.current as any).setInputValue("");
      if (!client) {
        setUserInputQueue((queue) => {
          return [...queue, input];
        });
        return;
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
      if (input.trim() === "") return;

      client.sendMainInput(input);
      setUserInputQueue((queue) => {
        return [...queue, input];
      });

      // Increment localstorage counter
      const counter = localStorage.getItem("mainTextEntryCounter");
      if (counter) {
        let currentCount = parseInt(counter);
        localStorage.setItem(
          "mainTextEntryCounter",
          (currentCount + 1).toString()
        );
        if (currentCount === 25) {
          setFeedbackDialogMessage(
            <div className="text-center">
              👋 Thanks for using Continue. We are a beta product and love
              working closely with our first users. If you're interested in
              speaking, enter your name and email. We won't use this information
              for anything other than reaching out.
              <br />
              <br />
              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  posthog?.capture("user_interest_form", {
                    name: e.target.elements[0].value,
                    email: e.target.elements[1].value,
                  });
                  setFeedbackDialogMessage(
                    <div className="text-center">
                      Thanks! We'll be in touch soon.
                    </div>
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
          );
          setFeedbackEntryOn(false);
          setShowFeedbackDialog(true);
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

  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true);
    }, 3000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // const iterations = useSelector(selectIterations);
  return (
    <>
      <Onboarding />
      <TextDialog
        showDialog={showFeedbackDialog}
        onEnter={(text) => {
          client?.sendMainInput(`/feedback ${text}`);
          setShowFeedbackDialog(false);
        }}
        onClose={() => {
          setShowFeedbackDialog(false);
        }}
        message={feedbackDialogMessage}
        entryOn={feedbackEntryOn}
      />

      <TopGUIDiv
        ref={topGuiDivRef}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            onMainTextInput();
          }
        }}
      >
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
              <u>Click to view logs</u>
            </p>
            <div className="w-3/4 m-auto text-center text-xs">
              Tip: Drag the Continue logo from the far left of the window to the
              right, then toggle Continue using option/alt+command+m.
            </div>
          </>
        )}
        {history?.timeline.map((node: HistoryNode, index: number) => {
          return node.step.name === "User Input" ? (
            node.step.hide || (
              <UserInputContainer
                onDelete={() => {
                  client?.deleteAtIndex(index);
                }}
                historyNode={node}
              >
                {node.step.description as string}
              </UserInputContainer>
            )
          ) : (
            <StepContainer
              index={index}
              isLast={index === history.timeline.length - 1}
              isFirst={index === 0}
              open={stepsOpen[index]}
              onToggle={() => {
                const nextStepsOpen = [...stepsOpen];
                nextStepsOpen[index] = !nextStepsOpen[index];
                setStepsOpen(nextStepsOpen);
              }}
              onToggleAll={() => {
                const shouldOpen = !stepsOpen[index];
                setStepsOpen((prev) => prev.map(() => shouldOpen));
              }}
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
            />
          );
        })}
        {waitingForSteps && <Loader></Loader>}

        <div>
          {userInputQueue.map((input) => {
            return <UserInputQueueItem>{input}</UserInputQueueItem>;
          })}
        </div>

        <div ref={aboveComboBoxDivRef} />
        <ComboBox
          ref={mainTextInputRef}
          onEnter={(e) => {
            onMainTextInput(e);
            e.stopPropagation();
            e.preventDefault();
          }}
          onInputValueChange={() => {}}
          items={availableSlashCommands}
          selectedContextItems={selectedContextItems}
          onToggleAddContext={() => {
            client?.toggleAddingHighlightedCode();
          }}
          addingHighlightedCode={addingHighlightedCode}
        />
        <ContinueButton onClick={onMainTextInput} />
      </TopGUIDiv>
      <BottomMessageDiv
        displayOnBottom={displayBottomMessageOnBottom}
        onMouseEnter={() => {
          dispatch(setBottomMessageCloseTimeout(undefined));
        }}
        onMouseLeave={(e) => {
          if (!e.buttons) {
            dispatch(setBottomMessage(undefined));
          }
        }}
        hidden={!bottomMessage}
      >
        {bottomMessage}
      </BottomMessageDiv>
      <Footer dataSwitchChecked={dataSwitchChecked}>
        {vscMediaUrl && (
          <a
            href="https://github.com/continuedev/continue"
            style={{ marginRight: "auto" }}
          >
            <img
              src={`${vscMediaUrl}/continue-dev-square.png`}
              width="22px"
              style={{ backgroundColor: "black", color: "red" }}
            />
          </a>
        )}
        <HeaderButtonWithText
          onClick={() => {
            // Show the dialog
            setFeedbackDialogMessage(
              `Continue uses GPT-4 by default, but works with any model. If you'd like to keep your code completely private, there are few options:

Run a local model with ggml: [5 minute quickstart](https://github.com/continuedev/ggml-server-example)

Use Azure OpenAI service, which is GDPR and HIPAA compliant: [Tutorial](https://continue.dev/docs/customization#azure-openai-service)

If you already have an LLM deployed on your own infrastructure, or would like to do so, please contact us at hi@continue.dev.
              `
            );
            setFeedbackEntryOn(false);
            setShowFeedbackDialog(true);
          }}
          text={"Use Private Model"}
        >
          <div
            style={{ fontSize: "18px", marginLeft: "2px", marginRight: "2px" }}
          >
            🔒
          </div>
        </HeaderButtonWithText>
        <HeaderButtonWithText
          onClick={() => {
            client?.sendClear();
          }}
          text="Clear"
        >
          <TrashIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
        <a
          href="https://continue.dev/docs/how-to-use-continue"
          className="no-underline"
        >
          <HeaderButtonWithText text="Docs">
            <BookOpenIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        </a>
        <HeaderButtonWithText
          onClick={() => {
            // Set dialog open
            setFeedbackDialogMessage(
              "Having trouble using Continue? Want a new feature? Let us know! This box is anonymous, but we will promptly address your feedback."
            );
            setFeedbackEntryOn(true);
            setShowFeedbackDialog(true);
          }}
          text="Feedback"
        >
          <ChatBubbleOvalLeftEllipsisIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      </Footer>
    </>
  );
}

export default GUI;

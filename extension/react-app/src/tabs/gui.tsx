import styled from "styled-components";
import { defaultBorderRadius, Loader } from "../components";
import ContinueButton from "../components/ContinueButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { History } from "../../../schema/History";
import { HistoryNode } from "../../../schema/HistoryNode";
import StepContainer from "../components/StepContainer";
import useContinueGUIProtocol from "../hooks/useWebsocket";
import {
  BookOpen,
  ChatBubbleOvalLeftEllipsis,
  Trash,
} from "@styled-icons/heroicons-outline";
import ComboBox from "../components/ComboBox";
import TextDialog from "../components/TextDialog";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import ReactSwitch from "react-switch";
import { usePostHog } from "posthog-js/react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import LoadingCover from "../components/LoadingCover";
import { postVscMessage } from "../vscode";

const TopGUIDiv = styled.div`
  overflow: hidden;
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
  const posthog = usePostHog();
  const vscMachineId = useSelector(
    (state: RootStore) => state.config.vscMachineId
  );
  const [dataSwitchChecked, setDataSwitchChecked] = useState(false);
  const dataSwitchOn = useSelector(
    (state: RootStore) => state.config.dataSwitchOn
  )

  useEffect(() => {
    if (typeof dataSwitchOn !== "undefined") {
      setDataSwitchChecked(dataSwitchOn)
    }
  }, [dataSwitchOn])

  const [usingFastModel, setUsingFastModel] = useState(false);
  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [userInputQueue, setUserInputQueue] = useState<string[]>([]);
  const [availableSlashCommands, setAvailableSlashCommands] = useState<
    { name: string; description: string }[]
  >([]);
  const [showDataSharingInfo, setShowDataSharingInfo] = useState(false);
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
          name: "SequentialStep",
          hide: true,
          description: "Running step: SequentialStep",
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
          steps: [
            {
              name: "Welcome to Continue",
              hide: false,
              description: `Welcome to Continue`,
              system_message: null,
              chat_context: [],
              manage_own_chat_context: false,
              message: `# Welcome to Continue

              _If it's your first time using Continue, it can take up to a minute for the server to install._
              
              Continue is not perfect, but a great tool to add to your toolbox. These are the tasks that Continue is currently best at:
              
              - Highlight a section of code and instruct Continue to refactor it, e.g. \`"/edit make this use more descriptive variable names"\`
              - Ask questions of the open file, e.g. \`"/explain what is the purpose of each of these if statements?"\`
              - Ask Continue to build the scaffolding of a new file from scratch, e.g. \`"add a React component for syntax highlighted code"\`
              
              You can use "slash commands" to directly instruct Continue what to do, or just enter a request and it will automatically decide next steps. To see the list of available slash commands, type '/'.
              
              If you highlight code, edits and explanations will be localized to the highlighted range. Otherwise, the currently open file is used. In both cases, the code is combined with the previous steps to construct the context.
              `,
            },
            {
              name: "Welcome to Continue!",
              hide: true,
              description: "Welcome to Continue!",
              system_message: null,
              chat_context: [],
              manage_own_chat_context: false,
            },
            {
              name: "StepsOnStartupStep",
              hide: true,
              description: "Running steps on startup",
              system_message: null,
              chat_context: [],
              manage_own_chat_context: false,
            },
          ],
        },
        observation: null,
        depth: 0,
        deleted: false,
        active: false,
      },
      {
        step: {
          name: "Welcome to Continue",
          hide: false,
          description:
            "Type '/' to see the list of available slash commands. If you highlight code, edits and explanations will be localized to the highlighted range. Otherwise, the currently open file is used. In both cases, the code is combined with the previous steps to construct the context.",
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
          message:
            "Type '/' to see the list of available slash commands. If you highlight code, edits and explanations will be localized to the highlighted range. Otherwise, the currently open file is used. In both cases, the code is combined with the previous steps to construct the context.",
        },
        observation: {
          text: "Type '/' to see the list of available slash commands. If you highlight code, edits and explanations will be localized to the highlighted range. Otherwise, the currently open file is used. In both cases, the code is combined with the previous steps to construct the context.",
        },
        depth: 1,
        deleted: false,
        active: false,
      },
      {
        step: {
          name: "Welcome to Continue!",
          hide: true,
          description: "Welcome to Continue!",
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
        },
        observation: null,
        depth: 1,
        deleted: false,
        active: false,
      },
      {
        step: {
          name: "StepsOnStartupStep",
          hide: true,
          description: "Running steps on startup",
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
        },
        observation: null,
        depth: 1,
        deleted: false,
        active: false,
      },
    ],
    current_index: 3,
  } as any);
  //   {
  //   timeline: [
  //     {
  //       step: {
  //         name: "Waiting for user input",
  //         cmd: "python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //         description:
  //           "Run `python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py` and ```\nprint(sum(first, second))\n```\n- Testing\n- Testing 2\n- Testing 3",
  //       },
  //       observation: {
  //         title: "ERROR FOUND",
  //         error:
  //           "Traceback (most recent call last):\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/main.py\", line 7, in <module>\n    print(sum(first, second))\n          ^^^^^^^^^^^^^^^^^^\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/sum.py\", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError: unsupported operand type(s) for +: 'int' and 'str'",
  //       },
  //       output: [
  //         {
  //           traceback: {
  //             frames: [
  //               {
  //                 filepath:
  //                   "/Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //                 lineno: 7,
  //                 function: "<module>",
  //                 code: "print(sum(first, second))",
  //               },
  //             ],
  //             message: "unsupported operand type(s) for +: 'int' and 'str'",
  //             error_type:
  //               '          ^^^^^^^^^^^^^^^^^^\n  File "/Users/natesesti/Desktop/continue/extension/examples/python/sum.py", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError',
  //             full_traceback:
  //               "Traceback (most recent call last):\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/main.py\", line 7, in <module>\n    print(sum(first, second))\n          ^^^^^^^^^^^^^^^^^^\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/sum.py\", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError: unsupported operand type(s) for +: 'int' and 'str'",
  //           },
  //         },
  //         null,
  //       ],
  //     },
  //     {
  //       step: {
  //         name: "EditCodeStep",
  //         range_in_files: [
  //           {
  //             filepath:
  //               "/Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //             range: {
  //               start: {
  //                 line: 0,
  //                 character: 0,
  //               },
  //               end: {
  //                 line: 6,
  //                 character: 25,
  //               },
  //             },
  //           },
  //         ],
  //         prompt:
  //           "I ran into this problem with my Python code:\n\n                Traceback (most recent call last):\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/main.py\", line 7, in <module>\n    print(sum(first, second))\n          ^^^^^^^^^^^^^^^^^^\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/sum.py\", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError: unsupported operand type(s) for +: 'int' and 'str'\n\n                Below are the files that might need to be fixed:\n\n                {code}\n\n                This is what the code should be in order to avoid the problem:\n",
  //         description:
  //           "Run `python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py` and\n```python\nprint(sum(first, second))\n```\n- Testing\n- Testing 2\n- Testing 3",
  //       },
  //       output: [
  //         null,
  //         {
  //           reversible: true,
  //           actions: [
  //             {
  //               reversible: true,
  //               filesystem: {},
  //               filepath:
  //                 "/Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //               range: {
  //                 start: {
  //                   line: 0,
  //                   character: 0,
  //                 },
  //                 end: {
  //                   line: 6,
  //                   character: 25,
  //                 },
  //               },
  //               replacement:
  //                 "\nfrom sum import sum\n\nfirst = 1\nsecond = 2\n\nprint(sum(first, second))",
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //     {
  //       active: false,
  //       step: {
  //         name: "SolveTracebackStep",
  //         traceback: {
  //           frames: [
  //             {
  //               filepath:
  //                 "/Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //               lineno: 7,
  //               function: "<module>",
  //               code: "print(sum(first, second))",
  //             },
  //           ],
  //           message: "unsupported operand type(s) for +: 'int' and 'str'",
  //           error_type:
  //             '          ^^^^^^^^^^^^^^^^^^\n  File "/Users/natesesti/Desktop/continue/extension/examples/python/sum.py", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError',
  //           full_traceback:
  //             "Traceback (most recent call last):\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/main.py\", line 7, in <module>\n    print(sum(first, second))\n          ^^^^^^^^^^^^^^^^^^\n  File \"/Users/natesesti/Desktop/continue/extension/examples/python/sum.py\", line 2, in sum\n    return a + b\n           ~~^~~\nTypeError: unsupported operand type(s) for +: 'int' and 'str'",
  //         },
  //         description: "Running step: SolveTracebackStep",
  //       },
  //       output: [null, null],
  //     },
  //     {
  //       step: {
  //         name: "RunCodeStep",
  //         cmd: "python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //         description:
  //           "Run `python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py`",
  //       },
  //       output: [null, null],
  //     },
  //   ],
  //   current_index: 3,
  // } as any);

  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const topGuiDivRef = useRef<HTMLDivElement>(null);
  const client = useContinueGUIProtocol();

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
    const listener = (e: any) => {
      // Cmd + J to toggle fast model
      if (e.key === "i" && e.metaKey && e.shiftKey) {
        setUsingFastModel((prev) => !prev);
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, []);

  useEffect(() => {
    client?.onStateUpdate((state) => {
      // Scroll only if user is at very bottom of the window.
      setUsingFastModel(state.default_model === "gpt-3.5-turbo");
      const shouldScrollToBottom =
        topGuiDivRef.current &&
        topGuiDivRef.current?.offsetHeight - window.scrollY < 100;
      setWaitingForSteps(state.active);
      setHistory(state.history);
      setUserInputQueue(state.user_input_queue);
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
    client?.onAvailableSlashCommands((commands) => {
      console.log("Received available slash commands: ", commands);
      setAvailableSlashCommands(
        commands.map((c) => {
          return {
            name: "/" + c.name,
            description: c.description,
          };
        })
      );
    });
  }, [client]);

  useEffect(() => {
    scrollToBottom();
  }, [waitingForSteps]);

  const mainTextInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mainTextInputRef.current) {
      mainTextInputRef.current.focus();
      let handler = (event: any) => {
        if (event.data.type === "focusContinueInput") {
          mainTextInputRef.current?.focus();
        }
      };
      window.addEventListener("message", handler);
      return () => {
        window.removeEventListener("message", handler);
      };
    }
  }, [mainTextInputRef]);

  const onMainTextInput = () => {
    if (mainTextInputRef.current) {
      let input = mainTextInputRef.current.value;
      mainTextInputRef.current.value = "";
      if (!client) return;

      if (
        history?.timeline.length &&
        history.timeline[history.current_index].step.name ===
          "Waiting for user input"
      ) {
        if (input.trim() === "") return;
        onStepUserInput(input, history!.current_index);
      } else if (
        history?.timeline.length &&
        history.timeline[history.current_index].step.name ===
          "Waiting for user confirmation"
      ) {
        onStepUserInput("ok", history!.current_index);
      } else {
        if (input.trim() === "") return;

        client.sendMainInput(input);
        setUserInputQueue((queue) => {
          return [...queue, input];
        });
      }
    }

    setWaitingForSteps(true);
  };

  const onStepUserInput = (input: string, index: number) => {
    if (!client) return;
    console.log("Sending step user input", input, index);
    client.sendStepUserInput(input, index);
  };

  // const iterations = useSelector(selectIterations);
  return (
    <>
      <LoadingCover hidden={true} message="Downloading local model..." />
      <TextDialog
        showDialog={showFeedbackDialog}
        onEnter={(text) => {
          client?.sendMainInput(`/feedback ${text}`);
          setShowFeedbackDialog(false);
        }}
        onClose={() => {
          setShowFeedbackDialog(false);
        }}
      ></TextDialog>

      <TopGUIDiv
        ref={topGuiDivRef}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            onMainTextInput();
          }
        }}
      >
        {typeof client === "undefined" && (
          <>
            <Loader></Loader>
            <p style={{ textAlign: "center" }}>Loading Continue server...</p>
          </>
        )}
        {history?.timeline.map((node: HistoryNode, index: number) => {
          return (
            <StepContainer
              isLast={index === history.timeline.length - 1}
              isFirst={index === 0}
              open={stepsOpen[index]}
              onToggle={() => {
                const nextStepsOpen = [...stepsOpen];
                nextStepsOpen[index] = !nextStepsOpen[index];
                setStepsOpen(nextStepsOpen);
              }}
              onToggleAll={() => {
                setStepsOpen((prev) => prev.map((_, index) => !prev[index]));
              }}
              key={index}
              onUserInput={(input: string) => {
                onStepUserInput(input, index);
              }}
              inFuture={index > history?.current_index}
              historyNode={node}
              onRefinement={(input: string) => {
                client?.sendRefinementInput(input, index);
              }}
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

        <ComboBox
          // disabled={
          //   history?.timeline.length
          //     ? history.timeline[history.current_index].step.name ===
          //       "Waiting for user confirmation"
          //     : false
          // }
          ref={mainTextInputRef}
          onEnter={(e) => {
            onMainTextInput();
            e.stopPropagation();
            e.preventDefault();
          }}
          onInputValueChange={() => {}}
          items={availableSlashCommands}
        />
        <ContinueButton onClick={onMainTextInput} />
      </TopGUIDiv>
      <div
        style={{
          position: "fixed",
          bottom: "50px",
          backgroundColor: "white",
          color: "black",
          borderRadius: defaultBorderRadius,
          padding: "16px",
          margin: "16px",
        }}
        hidden={!showDataSharingInfo}
      >
        By turning on this switch, you will begin collecting accepted and 
        rejected suggestions in .continue/suggestions.json. This data is 
        stored locally on your machine and not sent anywhere.
        <br />
        <br />
        <b>
          {dataSwitchChecked
            ? "👍 Data is being collected"
            : "👎 No data is being collected"}
        </b>
      </div>
      <Footer dataSwitchChecked={dataSwitchChecked}>
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginRight: "auto",
            alignItems: "center",
          }}
          onMouseEnter={() => {
            setShowDataSharingInfo(true);
          }}
          onMouseLeave={() => {
            setShowDataSharingInfo(false);
          }}
        >
          <ReactSwitch
            height={20}
            handleDiameter={20}
            width={40}
            onChange={() => {
              posthog?.capture("data_switch_toggled", {
                vscMachineId: vscMachineId,
                dataSwitchChecked: !dataSwitchChecked,
              });
              postVscMessage("toggleDataSwitch", {on: !dataSwitchChecked})
              setDataSwitchChecked((prev) => !prev);
            }}
            onColor="#12887a"
            checked={dataSwitchChecked}
          />
          <span style={{ cursor: "help", fontSize: "14px" }}>
            Collect Data
          </span>
        </div>
        <HeaderButtonWithText
          onClick={() => {
            client?.changeDefaultModel(
              usingFastModel ? "gpt-4" : "gpt-3.5-turbo"
            );
            setUsingFastModel((prev) => !prev);
          }}
          text={usingFastModel ? "gpt-3.5-turbo" : "gpt-4"}
        >
          <div
            style={{ fontSize: "18px", marginLeft: "2px", marginRight: "2px" }}
          >
            {usingFastModel ? "⚡" : "🧠"}
          </div>
        </HeaderButtonWithText>
        <HeaderButtonWithText
          onClick={() => {
            client?.sendClear();
          }}
          text="Clear"
        >
          <Trash size="1.6em" />
        </HeaderButtonWithText>
        <a href="https://continue.dev/docs" className="no-underline">
          <HeaderButtonWithText text="Docs">
            <BookOpen size="1.6em" />
          </HeaderButtonWithText>
        </a>
        <HeaderButtonWithText
          onClick={() => {
            // Set dialog open
            setShowFeedbackDialog(true);
          }}
          text="Feedback"
        >
          <ChatBubbleOvalLeftEllipsis size="1.6em" />
        </HeaderButtonWithText>
      </Footer>
    </>
  );
}

export default GUI;

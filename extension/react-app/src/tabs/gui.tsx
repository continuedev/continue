import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  Loader,
  MainTextInput,
  HeaderButton,
} from "../components";
import ContinueButton from "../components/ContinueButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { History } from "../../../schema/History";
import { HistoryNode } from "../../../schema/HistoryNode";
import StepContainer from "../components/StepContainer";
import useContinueGUIProtocol from "../hooks/useWebsocket";
import {
  BookOpen,
  ChatBubbleOvalLeft,
  ChatBubbleOvalLeftEllipsis,
  Trash,
} from "@styled-icons/heroicons-outline";
import ComboBox from "../components/ComboBox";
import TextDialog from "../components/TextDialog";

const MainDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
`;

let TopGUIDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  background-color: ${vscBackground};
`;

let UserInputQueueItem = styled.div`
  border-radius: ${defaultBorderRadius};
  color: gray;
  padding: 8px;
  margin: 8px;
  text-align: center;
`;

const TopBar = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: right;
  padding: 8px;
  align-items: center;
  margin-top: 8px;
  border-top: 0.1px solid gray;
`;

interface GUIProps {
  firstObservation?: any;
}

function GUI(props: GUIProps) {
  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [userInputQueue, setUserInputQueue] = useState<string[]>([]);
  const [availableSlashCommands, setAvailableSlashCommands] = useState<
    { name: string; description: string }[]
  >([]);
  const [history, setHistory] = useState<History | undefined>();
  // {
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
          top: window.outerHeight,
          behavior: "smooth",
        });
      }, 200);
      setScrollTimeout(timeout);
    }
  }, [topGuiDivRef.current, scrollTimeout]);

  useEffect(() => {
    console.log("CLIENT ON STATE UPDATE: ", client, client?.onStateUpdate);
    client?.onStateUpdate((state) => {
      console.log("Received state update: ", state);
      setWaitingForSteps(state.active);
      setHistory(state.history);
      setUserInputQueue(state.user_input_queue);

      scrollToBottom();
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
      if (!client) return;
      let input = mainTextInputRef.current.value;

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
      <TextDialog
        showDialog={showFeedbackDialog}
        onEnter={(text) => {
          client?.sendMainInput(`/feedback ${text}`);
          setShowFeedbackDialog(false);
        }}
      ></TextDialog>
      <MainDiv>
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
              <p style={{ textAlign: "center" }}>
                Trying to reconnect with server...
              </p>
            </>
          )}
          {history?.timeline.map((node: HistoryNode, index: number) => {
            return (
              <StepContainer
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
            disabled={
              history?.timeline.length
                ? history.timeline[history.current_index].step.name ===
                  "Waiting for user confirmation"
                : false
            }
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

          <TopBar>
            <a href="https://continue.dev/docs" className="no-underline">
              <HeaderButton style={{ padding: "3px" }}>
                Continue Docs
                <BookOpen size="1.6em" />
              </HeaderButton>
            </a>
            <HeaderButton
              style={{ padding: "3px" }}
              onClick={() => {
                // Set dialog open
                setShowFeedbackDialog(true);
              }}
            >
              Feedback
              <ChatBubbleOvalLeftEllipsis size="1.6em" />
            </HeaderButton>
            <HeaderButton
              onClick={() => {
                client?.sendClear();
              }}
              style={{ padding: "3px" }}
            >
              Clear History
              <Trash size="1.6em" />
            </HeaderButton>
          </TopBar>
        </TopGUIDiv>
      </MainDiv>
    </>
  );
}

export default GUI;

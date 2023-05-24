import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  vscBackground,
  MainTextInput,
  Loader,
} from "../components";
import ContinueButton from "../components/ContinueButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { History } from "../../../schema/History";
import { HistoryNode } from "../../../schema/HistoryNode";
import StepContainer from "../components/StepContainer";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import useContinueWebsocket from "../hooks/useWebsocket";

let TopNotebookDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr;
`;

let UserInputQueueItem = styled.div`
  border-radius: ${defaultBorderRadius};
  color: gray;
  padding: 8px;
  margin: 8px;
  text-align: center;
`;

interface NotebookProps {
  firstObservation?: any;
}

function Notebook(props: NotebookProps) {
  const serverUrl = useSelector((state: RootStore) => state.config.apiUrl);

  const [waitingForSteps, setWaitingForSteps] = useState(false);
  const [userInputQueue, setUserInputQueue] = useState<string[]>([]);
  const [history, setHistory] = useState<History | undefined>();
  //   {
  //   timeline: [
  //     {
  //       step: {
  //         name: "RunCodeStep",
  //         cmd: "python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py",
  //         description:
  //           "Run `python3 /Users/natesesti/Desktop/continue/extension/examples/python/main.py`",
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
  //           "Editing files: /Users/natesesti/Desktop/continue/extension/examples/python/main.py",
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
  //   current_index: 0,
  // } as any
  // );

  const { send: websocketSend } = useContinueWebsocket(serverUrl, (msg) => {
    let data = JSON.parse(msg.data);
    if (data.messageType === "state") {
      setWaitingForSteps(data.state.active);
      setHistory(data.state.history);
      setUserInputQueue(data.state.user_input_queue);
    }
  });

  // useEffect(() => {
  //   (async () => {
  //     if (sessionId && props.firstObservation) {
  //       let resp = await fetch(serverUrl + "/observation", {
  //         method: "POST",
  //         headers: new Headers({
  //           "x-continue-session-id": sessionId,
  //         }),
  //         body: JSON.stringify({
  //           observation: props.firstObservation,
  //         }),
  //       });
  //     }
  //   })();
  // }, [props.firstObservation]);

  const mainTextInputRef = useRef<HTMLTextAreaElement>(null);

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
      let value = mainTextInputRef.current.value;
      setWaitingForSteps(true);
      websocketSend({
        messageType: "main_input",
        value: value,
      });
      setUserInputQueue((queue) => {
        return [...queue, value];
      });
      mainTextInputRef.current.value = "";
      mainTextInputRef.current.style.height = "";
    }
  };

  const onStepUserInput = (input: string, index: number) => {
    console.log("Sending step user input", input, index);
    websocketSend({
      messageType: "step_user_input",
      value: input,
      index,
    });
  };

  // const iterations = useSelector(selectIterations);
  return (
    <TopNotebookDiv>
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
              websocketSend({
                messageType: "refinement_input",
                value: input,
                index,
              });
            }}
            onReverse={() => {
              websocketSend({
                messageType: "reverse",
                index,
              });
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

      <MainTextInput
        ref={mainTextInputRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onMainTextInput();
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        rows={1}
        onChange={() => {
          let textarea = mainTextInputRef.current!;
          textarea.style.height = ""; /* Reset the height*/
          textarea.style.height =
            Math.min(textarea.scrollHeight - 15, 500) + "px";
        }}
      ></MainTextInput>
      <ContinueButton onClick={onMainTextInput}></ContinueButton>
    </TopNotebookDiv>
  );
}

export default Notebook;

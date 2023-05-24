import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectChatMessages } from "../../redux/selectors/chatSelectors";
import MessageDiv from "./MessageDiv";
import styled from "styled-components";
import { addMessage, setIsStreaming } from "../../redux/slices/chatSlice";
import { AnyAction, Dispatch } from "@reduxjs/toolkit";
import { closeStream, streamUpdate } from "../../redux/slices/chatSlice";
import { ChatMessage, RootStore } from "../../redux/store";
import { postVscMessage, vscRequest } from "../../vscode";
import { defaultBorderRadius, Loader } from "../../components";
import { selectHighlightedCode } from "../../redux/selectors/miscSelectors";
import { readRangeInVirtualFileSystem } from "../../util";
import { selectDebugContext } from "../../redux/selectors/debugContextSelectors";

let textEntryBarHeight = "30px";

const ChatContainer = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100%;
`;

const BottomDiv = styled.div`
  display: grid;
  grid-template-rows: auto auto;
`;

const BottomButton = styled.button(
  (props: { active: boolean }) => `
  font-size: 10px;
  border: none;
  color: white;
  margin-right: 4px;
  cursor: pointer;
  background-color: ${props.active ? "black" : "gray"};
  border-radius: ${defaultBorderRadius};
  padding: 8px;
`
);

const TextEntryBar = styled.input`
  height: ${textEntryBarHeight};
  border-bottom-left-radius: ${defaultBorderRadius};
  border-bottom-right-radius: ${defaultBorderRadius};
  padding: 8px;
  border: 1px solid white;
  background-color: black;
  color: white;
  outline: none;
`;

function ChatTab() {
  const dispatch = useDispatch();
  const chatMessages = useSelector(selectChatMessages);
  const isStreaming = useSelector((state: RootStore) => state.chat.isStreaming);
  const baseUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const debugContext = useSelector(selectDebugContext);

  const [includeHighlightedCode, setIncludeHighlightedCode] = useState(true);
  const [writeToEditor, setWriteToEditor] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const highlightedCode = useSelector(selectHighlightedCode);

  const streamToStateThunk = useCallback(
    (dispatch: Dispatch<AnyAction>, getResponse: () => Promise<Response>) => {
      let streamToCursor = writeToEditor;
      getResponse().then((resp) => {
        setWaitingForResponse(false);
        if (resp.body) {
          resp.body.pipeTo(
            new WritableStream({
              write(chunk) {
                let update = new TextDecoder("utf-8").decode(chunk);
                dispatch(streamUpdate(update));
                if (streamToCursor) {
                  postVscMessage("streamUpdate", { update });
                }
              },
              close() {
                dispatch(closeStream());
                if (streamToCursor) {
                  postVscMessage("closeStream", null);
                }
              },
            })
          );
        }
      });
    },
    [writeToEditor]
  );

  const compileHiddenChatMessages = useCallback(async () => {
    let messages: ChatMessage[] = [];
    if (
      includeHighlightedCode &&
      highlightedCode?.filepath !== undefined &&
      highlightedCode?.range !== undefined &&
      debugContext.filesystem[highlightedCode.filepath] !== undefined
    ) {
      let fileContents = readRangeInVirtualFileSystem(
        highlightedCode,
        debugContext.filesystem
      );
      if (fileContents) {
        messages.push({
          role: "user",
          content: fileContents,
        });
      }
    } else {
      // Similarity search over workspace
      let data = await vscRequest("queryEmbeddings", {
        query: chatMessages[chatMessages.length - 1].content,
      });
      let codeContextMessages = data.results.map(
        (result: { id: string; document: string }) => {
          let msg: ChatMessage = {
            role: "user",
            content: `File: ${result.id} \n ${result.document}`,
          };
          return msg;
        }
      );
      codeContextMessages.push({
        role: "user",
        content:
          "Use the above code to help you answer the question below. Answer in asterisk bullet points, and give the full path whenever you reference files.",
      });
      messages.push(...codeContextMessages);
    }

    let systemMsgContent = writeToEditor
      ? "Respond only with the exact code requested, no additional text."
      : "Use the above code to help you answer the question below. Respond in markdown if using bullets or other special formatting, being sure to specify language for code blocks.";

    messages.push({
      role: "system",
      content: systemMsgContent,
    });
    return messages;
  }, [highlightedCode, chatMessages, includeHighlightedCode, writeToEditor]);

  useEffect(() => {
    if (
      chatMessages.length > 0 &&
      chatMessages[chatMessages.length - 1].role === "user" &&
      !isStreaming
    ) {
      dispatch(setIsStreaming(true));
      streamToStateThunk(dispatch, async () => {
        if (chatMessages.length === 0) {
          return new Promise((resolve, _) => resolve(new Response()));
        }
        let hiddenChatMessages = await compileHiddenChatMessages();
        let augmentedMessages = [
          ...chatMessages.slice(0, -1),
          ...hiddenChatMessages,
          chatMessages[chatMessages.length - 1],
        ];
        console.log(augmentedMessages);
        // The autogenerated client can't handle streams, so have to go raw
        return fetch(`${baseUrl}/chat/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: augmentedMessages,
          }),
        });
      });
    }
  }, [chatMessages, dispatch, isStreaming, highlightedCode]);

  const chatMessagesDiv = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll to bottom
    let interval = setInterval(() => {
      if (chatMessagesDiv.current && !waitingForResponse) {
        chatMessagesDiv.current.scrollTop += Math.max(
          4,
          0.05 * chatMessagesDiv.current.scrollHeight -
            chatMessagesDiv.current.clientHeight -
            chatMessagesDiv.current.scrollTop
        );
        if (
          chatMessagesDiv.current.scrollTop >=
          chatMessagesDiv.current.scrollHeight -
            chatMessagesDiv.current.clientHeight
        ) {
          clearInterval(interval);
        }
      }
    }, 10);
  }, [chatMessages, chatMessagesDiv, waitingForResponse]);

  return (
    <ChatContainer>
      <div className="mx-5 overflow-y-scroll" ref={chatMessagesDiv}>
        <h1>Chat</h1>
        <hr></hr>
        <div>
          {chatMessages.length > 0 ? (
            chatMessages.map((message, idx) => {
              return <MessageDiv key={idx} {...message}></MessageDiv>;
            })
          ) : (
            <p className="text-gray-400 m-auto text-center">
              You can ask questions about your codebase or ask for code written
              directly in the editor.
            </p>
          )}
          {waitingForResponse && <Loader></Loader>}
        </div>
      </div>

      <BottomDiv>
        <div className="h-12 bg-secondary-">
          <div className="flex items-center p-2">
            {/* <p className="mr-auto text-xs">
              Highlighted code is automatically included in your chat message.
            </p> */}
            <BottomButton
              className="ml-auto"
              active={writeToEditor}
              onClick={() => {
                setWriteToEditor(!writeToEditor);
              }}
            >
              {writeToEditor ? "Writing to editor" : "Write to editor"}
            </BottomButton>

            <BottomButton
              active={includeHighlightedCode}
              onClick={() => {
                setIncludeHighlightedCode(!includeHighlightedCode);
              }}
            >
              {includeHighlightedCode
                ? "Including highlighted code"
                : "Automatically finding relevant code"}
            </BottomButton>
          </div>
        </div>
        <TextEntryBar
          type="text"
          placeholder="Enter your message here"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value !== "") {
              console.log("Sending message", e.currentTarget.value);
              dispatch(
                addMessage({ content: e.currentTarget.value, role: "user" })
              );
              (e.target as any).value = "";
              setWaitingForResponse(true);
            }
          }}
        ></TextEntryBar>
      </BottomDiv>
    </ChatContainer>
  );
}

export default ChatTab;

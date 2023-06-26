import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { postVscMessage } from "../vscode";
import { useDispatch } from "react-redux";
import {
  setApiUrl,
  setVscMachineId,
  setSessionId,
  setVscMediaUrl,
} from "../redux/slices/configSlice";
import { setHighlightedCode } from "../redux/slices/miscSlice";
import { updateFileSystem } from "../redux/slices/debugContexSlice";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";
interface DebugPanelProps {
  tabs: {
    element: React.ReactElement;
    title: string;
  }[];
}

const TabBar = styled.div<{ numTabs: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.numTabs}, 1fr);
`;

const TabsAndBodyDiv = styled.div`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  scrollbar-base-color: transparent;
`;

function DebugPanel(props: DebugPanelProps) {
  const dispatch = useDispatch();
  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
        case "onLoad":
          dispatch(setApiUrl(event.data.apiUrl));
          dispatch(setVscMachineId(event.data.vscMachineId));
          dispatch(setSessionId(event.data.sessionId));
          dispatch(setVscMediaUrl(event.data.vscMediaUrl));
          break;
        case "highlightedCode":
          dispatch(setHighlightedCode(event.data.rangeInFile));
          dispatch(updateFileSystem(event.data.filesystem));
          break;
      }
    };
    window.addEventListener("message", eventListener);
    postVscMessage("onLoad", {});
    return () => window.removeEventListener("message", eventListener);
  }, []);

  const [currentTab, setCurrentTab] = useState(0);

  return (
    <TabsAndBodyDiv>
      {props.tabs.length > 1 && (
        <TabBar numTabs={props.tabs.length}>
          {props.tabs.map((tab, index) => {
            return (
              <div
                key={index}
                className={`p-2 cursor-pointer text-center ${
                  index === currentTab
                    ? "bg-secondary-dark"
                    : "bg-vsc-background"
                }`}
                onClick={() => setCurrentTab(index)}
              >
                {tab.title}
              </div>
            );
          })}
        </TabBar>
      )}
      {props.tabs.map((tab, index) => {
        return (
          <div
            key={index}
            hidden={index !== currentTab}
            style={{
              scrollbarGutter: "stable both-edges",
              minHeight: "100%",
              display: "grid",
              gridTemplateRows: "1fr auto",
            }}
          >
            {tab.element}
          </div>
        );
      })}
    </TabsAndBodyDiv>
  );
}

export default DebugPanel;

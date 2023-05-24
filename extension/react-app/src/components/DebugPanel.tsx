import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { postVscMessage } from "../vscode";
import { useDispatch } from "react-redux";
import {
  setApiUrl,
  setVscMachineId,
  setSessionId,
} from "../redux/slices/configSlice";
import { setHighlightedCode } from "../redux/slices/miscSlice";
import { updateFileSystem } from "../redux/slices/debugContexSlice";
import { buttonColor, defaultBorderRadius, vscBackground } from ".";
interface DebugPanelProps {
  tabs: {
    element: React.ReactElement;
    title: string;
  }[];
}

const GradientContainer = styled.div`
  // Uncomment to get gradient border
  background: linear-gradient(
    101.79deg,
    #12887a 0%,
    #87245c 37.64%,
    #e12637 65.98%,
    #ffb215 110.45%
  );
  /* padding: 10px; */
  margin: 0;
  height: 100%;
  /* border: 1px solid white; */
  border-radius: ${defaultBorderRadius};
`;

const MainDiv = styled.div`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  overflow: scroll;
  scrollbar-base-color: transparent;
  /* background: ${vscBackground}; */
  background-color: #1e1e1ede;
`;

const TabBar = styled.div<{ numTabs: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.numTabs}, 1fr);
`;

const TabsAndBodyDiv = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
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
    <GradientContainer>
      <MainDiv>
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
                className={
                  tab.title === "Chat" ? "overflow-hidden" : "overflow-scroll"
                }
              >
                {tab.element}
              </div>
            );
          })}
        </TabsAndBodyDiv>
      </MainDiv>
    </GradientContainer>
  );
}

export default DebugPanel;

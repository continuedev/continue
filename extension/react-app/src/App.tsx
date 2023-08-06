import GUI from "./pages/gui";
import History from "./pages/history";
import Layout from "./components/Layout";
import { createContext, useEffect } from "react";
import useContinueGUIProtocol from "./hooks/useWebsocket";
import ContinueGUIClientProtocol from "./hooks/ContinueGUIClientProtocol";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  BrowserRouter,
} from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  setApiUrl,
  setVscMachineId,
  setSessionId,
  setVscMediaUrl,
  setDataSwitchOn,
} from "./redux/slices/configSlice";
import { updateFileSystem } from "./redux/slices/debugContexSlice";
import { setHighlightedCode } from "./redux/slices/miscSlice";
import { postVscMessage } from "./vscode";

export const GUIClientContext = createContext<
  ContinueGUIClientProtocol | undefined
>(undefined);

function App() {
  const client = useContinueGUIProtocol();

  const dispatch = useDispatch();
  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
        case "onLoad":
          dispatch(setApiUrl(event.data.apiUrl));
          dispatch(setVscMachineId(event.data.vscMachineId));
          dispatch(setSessionId(event.data.sessionId));
          dispatch(setVscMediaUrl(event.data.vscMediaUrl));
          dispatch(setDataSwitchOn(event.data.dataSwitchOn));
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

  return (
    <GUIClientContext.Provider value={client}>
      <Routes>
        <Route path="/" element={<Layout />} />
        <Route path="/gui" element={<GUI />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </GUIClientContext.Provider>
  );
}

export default App;

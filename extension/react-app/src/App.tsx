import GUI from "./pages/gui";
import History from "./pages/history";
import Layout from "./components/Layout";
import { createContext, useEffect } from "react";
import useContinueGUIProtocol from "./hooks/useWebsocket";
import ContinueGUIClientProtocol from "./hooks/ContinueGUIClientProtocol";
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
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import ErrorPage from "./pages/error";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/index.html",
        element: <GUI />,
      },
      {
        path: "/",
        element: <GUI />,
      },
      {
        path: "/history",
        element: <History />,
      },
    ],
  },
]);

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
      <RouterProvider router={router} />
    </GUIClientContext.Provider>
  );
}

export default App;

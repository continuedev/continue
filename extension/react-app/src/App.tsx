import DebugPanel from "./components/DebugPanel";
import MainTab from "./tabs/main";
import WelcomeTab from "./tabs/welcome";
import ChatTab from "./tabs/chat";
import GUI from "./tabs/gui";
import { createContext } from "react";
import useContinueGUIProtocol from "./hooks/useWebsocket";
import ContinueGUIClientProtocol from "./hooks/useContinueGUIProtocol";

export const GUIClientContext = createContext<
  ContinueGUIClientProtocol | undefined
>(undefined);

function App() {
  const client = useContinueGUIProtocol();

  return (
    <GUIClientContext.Provider value={client}>
      <DebugPanel
        tabs={[
          {
            element: <GUI />,
            title: "GUI",
          },
          // { element: <MainTab />, title: "Debug Panel" },
          // { element: <WelcomeTab />, title: "Welcome" },
          // { element: <ChatTab />, title: "Chat" },
        ]}
      />
    </GUIClientContext.Provider>
  );
}

export default App;

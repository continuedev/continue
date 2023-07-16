import DebugPanel from "./components/DebugPanel";
import GUI from "./pages/gui";
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
          { element: <GUI />, title: "GUI" }
        ]}
      />
    </GUIClientContext.Provider>
  );
}

export default App;

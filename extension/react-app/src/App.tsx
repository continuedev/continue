import DebugPanel from "./components/DebugPanel";
import MainTab from "./tabs/main";
import { Provider } from "react-redux";
import store from "./redux/store";
import WelcomeTab from "./tabs/welcome";
import ChatTab from "./tabs/chat";
import GUI from "./tabs/gui";

function App() {
  return (
    <>
      <Provider store={store}>
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
        ></DebugPanel>
      </Provider>
    </>
  );
}

export default App;

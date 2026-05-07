import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import {
  IdeMessenger,
  IdeMessengerProvider,
  type IIdeMessenger,
} from "./context/IdeMessenger";
import { MockIdeMessenger } from "./context/MockIdeMessenger";
import "./index.css";
import { persistor, store } from "./redux/store";
import { isJetBrains } from "./util";

void (async () => {
  const container = document.getElementById("root") as HTMLElement;
  const windowAny = window as any;
  const hasVsCodeBridge = typeof windowAny.acquireVsCodeApi === "function";
  const hasJetBrainsBridge =
    isJetBrains() && typeof windowAny.postIntellijMessage === "function";
  const messenger: IIdeMessenger =
    hasVsCodeBridge || hasJetBrainsBridge
      ? new IdeMessenger()
      : new MockIdeMessenger();

  // Create React root
  const root = ReactDOM.createRoot(container);

  root.render(
    <React.StrictMode>
      <IdeMessengerProvider messenger={messenger}>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </IdeMessengerProvider>
    </React.StrictMode>,
  );
})();

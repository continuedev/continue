import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./index.css";
import { persistor, store } from "./redux/store";

import { proxyFetch } from "core/util";
import { PersistGate } from "redux-persist/integration/react";
import CustomPostHogProvider from "./hooks/CustomPostHogProvider";

(window as any)._fetch = window.fetch;
window.fetch = proxyFetch;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <CustomPostHogProvider>
          <App />
        </CustomPostHogProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);

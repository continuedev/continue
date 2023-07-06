import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import store from "./redux/store";
import "./index.css";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
  api_host: "https://app.posthog.com",
  session_recording: {
    // WARNING: Only enable this if you understand the security implications
    recordCrossOriginIframes: true,
  } as any,
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <Provider store={store}>
        <App />
      </Provider>
    </PostHogProvider>
  </React.StrictMode>
);

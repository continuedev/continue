import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
  api_host: "https://app.posthog.com",
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </React.StrictMode>
);

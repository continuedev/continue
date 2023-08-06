import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import store from "./redux/store";
import "./index.css";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
]);

console.log("Starting React");

posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
  api_host: "https://app.posthog.com",
  disable_session_recording: true,
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </PostHogProvider>
  </React.StrictMode>
);

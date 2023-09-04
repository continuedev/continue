import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import store from "./redux/store";
import "./index.css";

import CustomPostHogProvider from "./hooks/CustomPostHogProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <CustomPostHogProvider>
        <App />
      </CustomPostHogProvider>
    </Provider>
  </React.StrictMode>
);

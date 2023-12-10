import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./index.css";
import { store } from "./redux/store";

import CustomPostHogProvider from "./hooks/CustomPostHogProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      {/* <PersistGate loading={null} persistor={persistor}> */}
      <CustomPostHogProvider>
        <App />
      </CustomPostHogProvider>
      {/* </PersistGate> */}
    </Provider>
  </React.StrictMode>
);

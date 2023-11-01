import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { store, persistor } from "./redux/store";
import "./index.css";
import { PersistGate } from "redux-persist/integration/react";

import CustomPostHogProvider from "./hooks/CustomPostHogProvider";

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

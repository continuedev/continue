import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import CustomPostHogProvider from "./hooks/CustomPostHogProvider";
import "./index.css";
import { persistor, store } from "./redux/store";

(async () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <CustomPostHogProvider>
            <App />
          </CustomPostHogProvider>
        </PersistGate>
      </Provider>
    </React.StrictMode>,
  );
})();

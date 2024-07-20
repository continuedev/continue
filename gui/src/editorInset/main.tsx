import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import "../index.css";
import { store } from "../redux/store";

import EditorInset from "./EditorInset";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
        <EditorInset />
    </Provider>
  </React.StrictMode>,
);

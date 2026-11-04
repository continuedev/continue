import React from "react";
import ReactDOM from "react-dom/client";
import { StyleSheetManager } from "styled-components";
import Layout from "./components/console/Layout";
import "./indexConsole.css";
import { shouldForwardProp } from "./styles/shouldForwardProp";

void (async () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>
        <Layout></Layout>
      </StyleSheetManager>
    </React.StrictMode>,
  );
})();

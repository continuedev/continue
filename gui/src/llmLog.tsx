import React from "react";
import ReactDOM from "react-dom/client";
import Layout from "./components/llmLog/Layout";
import "./indexLLMLog.css";
import "@vscode/codicons/dist/codicon.css";

(async () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Layout></Layout>
    </React.StrictMode>,
  );
})();

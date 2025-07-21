import React from "react";
import ReactDOM from "react-dom/client";
import Layout from "./components/console/Layout";
import "./indexConsole.css";

void (async () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Layout></Layout>
    </React.StrictMode>,
  );
})();

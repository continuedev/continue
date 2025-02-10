import React from "react";
import { createRoot } from "react-dom/client";
import { GraniteWizard } from "./GraniteWizard";
import "./indexSetupGranite.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <GraniteWizard />
  </React.StrictMode>,
);

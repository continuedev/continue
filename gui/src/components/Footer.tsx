import { useState } from "react";
import { useAppSelector } from "../redux/hooks";
import { selectDefaultModel } from "../redux/slices/configSlice";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import { getLocalStorage } from "../util/localStorage";
import FreeTrialProgressBar from "./loaders/FreeTrialProgressBar";

function Footer() {
  const defaultModel = useAppSelector(selectDefaultModel);
  const [mode, setMode] = useState("chat");
  const [editedFiles, setEditedFiles] = useState([]);

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      const userConfirmed = window.confirm(
        "Switching modes will reset the current window and cancel the current response generation process. Do you want to continue?"
      );

      if (userConfirmed) {
        setMode(newMode);
        setEditedFiles([]);
        // Implement the logic to cancel the current response generation process here
      }
    }
  };

  const handleAcceptChanges = (fileName) => {
    // Implement the logic to accept changes made by the model here
  };

  const handleRejectChanges = (fileName) => {
    // Implement the logic to reject changes made by the model here
  };

  const handleDiffChanges = (fileName) => {
    // Implement the logic to show diff changes made by the model here
  };

  return (
    <footer className="flex flex-col border-0 border-t border-solid border-t-zinc-700 px-2 py-2">
      <div className="flex justify-between items-center mb-2">
        <div>
          <label>
            <input
              type="radio"
              value="chat"
              checked={mode === "chat"}
              onChange={() => handleModeChange("chat")}
            />
            Chat
          </label>
          <label className="ml-4">
            <input
              type="radio"
              value="agent"
              checked={mode === "agent"}
              onChange={() => handleModeChange("agent")}
            />
            Agent
          </label>
        </div>
      </div>
      {mode === "agent" && (
        <div className="flex flex-col">
          <div className="mb-2">
            <strong>Edited Files:</strong>
          </div>
          <ul>
            {editedFiles.map((file) => (
              <li key={file.name} className="flex justify-between items-center">
                <span
                  className="cursor-pointer"
                  onClick={() => {
                    // Implement the logic to open the file in the code editor here
                  }}
                >
                  {file.name}
                </span>
                <div>
                  <button
                    className="mr-2"
                    onClick={() => handleAcceptChanges(file.name)}
                  >
                    Accept
                  </button>
                  <button
                    className="mr-2"
                    onClick={() => handleRejectChanges(file.name)}
                  >
                    Reject
                  </button>
                  <button onClick={() => handleDiffChanges(file.name)}>
                    Diff
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {defaultModel?.provider === "free-trial" && (
        <FreeTrialProgressBar
          completed={getLocalStorage("ftc") ?? 0}
          total={FREE_TRIAL_LIMIT_REQUESTS}
        />
      )}
    </footer>
  );
}

export default Footer;

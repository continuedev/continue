import React from "react";

const AiderManualInstallation: React.FC = () => {
  return (
    <div className="manual-installation">
      <h2>Manual Installation Guide for PearAI Creator (Powered by aider)</h2>
      <p>
        Automatic installation of PearAI Creator (Powered by aider) was
        unsuccessful. Please follow the steps below to manually install it to
        get it working.
      </p>
      <div className="installation-section">
        <h3>For macOS/Linux:</h3>
        <ol>
          <li>
            <strong>Install Homebrew - </strong> If not already installed, run:
            <pre>
              <code>
                /bin/bash -c "$(curl -fsSL
                https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
              </code>
            </pre>
          </li>
          <li>
            <strong>Install Python - </strong> Please run:
            <pre>
              <code>brew install python@3</code>
            </pre>
          </li>
          <li>
            <strong>Install aider - </strong> Please run:
            <pre>
              <code>brew install aider</code>
            </pre>
          </li>
          <li>
            <strong>Restart PearAI</strong>
            <p>
              After installing the above prerequisites, reopen PearAI and PearAI
              Creator should work! If not, please view{" "}
              <a href="https://trypear.ai/creator-troubleshooting">
                PearAI Troubleshooting
              </a>
              , or contact PearAI Support on{" "}
              <a href="https://discord.gg/avc2y2Kqsa">Discord</a>.
            </p>
          </li>
        </ol>
      </div>
      <div className="installation-section">
        <h3>For Windows:</h3>
        <ol>
          <li>
            <strong>Install Python - </strong> If not already installed, run:
            <pre>
              <code>winget install Python.Python.3.9</code>
            </pre>
          </li>
          <li>
            <strong>Install aider - </strong> Please run:
            <pre>
              <code>python -m pip install -U aider-chat</code>
            </pre>
          </li>
          <li>
            <strong>Restart PearAI</strong>
            <p>
              After installing the above prerequisites, reopen PearAI and PearAI
              Creator should work! If not, please view{" "}
              <a href="https://trypear.ai/creator-troubleshooting">
                PearAI Troubleshooting
              </a>
              , or contact PearAI Support on{" "}
              <a href="https://discord.gg/avc2y2Kqsa">Discord</a>.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default AiderManualInstallation;

import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  Cog6ToothIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { useContext, useMemo } from "react";

const DISCUSSIONS_LINK = "https://github.com/continuedev/continue/discussions";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
import { GhostButton } from "../../components";
import { useEditModel } from "../../components/mainInput/Lump/useEditBlock";
import { useMainEditor } from "../../components/mainInput/TipTapEditor";
import ToggleDiv from "../../components/ToggleDiv";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { analyzeError } from "../../util/errorAnalysis";

interface StreamErrorProps {
  error: unknown;
}

const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const { refreshProfiles } = useAuth();
  const { mainEditor } = useMainEditor();

  const {
    parsedError,
    statusCode,
    message,
    modelTitle,
    providerName,
    apiKeyUrl,
    helpUrl,
    customErrorMessage,
  } = useMemo(() => analyzeError(error, selectedModel), [error, selectedModel]);

  const handleRefreshProfiles = () => {
    void refreshProfiles("Clicked reload config from stream error dialog");
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const copyErrorToClipboard = () => {
    void navigator.clipboard.writeText(parsedError);
  };

  const history = useAppSelector((store) => store.session.history);

  const checkKeysButton = apiKeyUrl ? (
    <GhostButton
      className="flex items-center"
      onClick={() => ideMessenger.ide.openUrl(apiKeyUrl)}
    >
      <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>Check API key</span>
    </GhostButton>
  ) : null;

  const handleEditModel = useEditModel();

  const configButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => handleEditModel(selectedModel)}
    >
      <Cog6ToothIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>View config</span>
    </GhostButton>
  );

  const resubmitButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => {
        let index = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (
            history[i].message.role === "user" ||
            history[i].message.role === "tool"
          ) {
            index = i;
            break;
          }
        }

        if (!mainEditor) {
          console.error("Main editor not found, cannot resubmit message.");
          return;
        }

        const editorState =
          index === -1 ? mainEditor.getJSON() : history[index].editorState;

        void dispatch(
          streamResponseThunk({
            editorState,
            modifiers: {
              noContext: true,
              useCodebase: false,
            },
            index: index === -1 ? 0 : index,
          }),
        );
        dispatch(setShowDialog(false));
        dispatch(setDialogMessage(undefined));
      }}
    >
      <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>Resubmit last message</span>
    </GhostButton>
  );

  let errorContent = (
    <div className="mb-1 mt-3">
      <div className="m-0 p-0">
        <p className="m-0 mb-2 p-0">
          There was an error handling the response from{" "}
          {selectedModel?.title || "the model"}.
        </p>
        <p className="m-0 p-0">Please try to submit your message again.</p>
        <div className="mt-3">{resubmitButton}</div>
      </div>
    </div>
  );

  // Display components for specific errors
  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`This might mean your ${modelTitle} usage has been rate limited
                by ${providerName}.`}
        </span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-4">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 404) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>Likely causes:</span>
        <ul className="m-0">
          <li>
            <span>Invalid</span>
            <code>apiBase</code>
            {selectedModel && (
              <>
                <span>{`: `}</span>
                <code>{selectedModel.apiBase}</code>
              </>
            )}
          </li>
          <li>
            <span>Model/deployment not found</span>
            {selectedModel && (
              <>
                <span>{` for: `}</span>
                <code>{selectedModel.model}</code>
              </>
            )}
          </li>
        </ul>
        <div>{configButton}</div>
      </div>
    );
  }

  if (statusCode === 401) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`It's possible that your API key is invalid.`}</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 403) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Likely cause: not authorized to access the model deployment.`}</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (
    message &&
    (message.toLowerCase().includes("overloaded") ||
      message.toLowerCase().includes("malformed json"))
  ) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Most likely, the provider's server(s) are overloaded and streaming was interrupted. Try again later`}</span>
        {selectedModel ? (
          <span>
            {`Provider: `}
            <code>{selectedModel.underlyingProviderName}</code>
          </span>
        ) : null}
      </div>
    );
  }

  // Custom error message from error analysis (e.g. invalid API key, insufficient balance)
  if (customErrorMessage) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{customErrorMessage}</span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-2">
          {helpUrl && (
            <GhostButton
              className="flex items-center"
              onClick={() => ideMessenger.ide.openUrl(helpUrl)}
            >
              <ArrowTopRightOnSquareIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>View help documentation</span>
            </GhostButton>
          )}
          {apiKeyUrl && (
            <GhostButton
              className="flex items-center"
              onClick={() => ideMessenger.ide.openUrl(apiKeyUrl)}
            >
              <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>Check API key</span>
            </GhostButton>
          )}
          {configButton}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-3">
      {/* Concise error title */}
      <h3 className="text-error m-0 p-0 text-lg font-medium">
        Error handling model response
      </h3>

      {errorContent}

      {/* Expandable technical details using ToggleDiv */}
      {message && (
        <div className="mb-2">
          <ToggleDiv
            title="View error output"
            testId="error-output-toggle"
            defaultOpen
          >
            <div className="flex flex-col gap-0 rounded-sm">
              <code className="text-editor-foreground block max-h-48 overflow-y-auto p-3 font-mono text-xs">
                {parsedError}
              </code>

              <div className="flex flex-row items-center justify-end gap-2 p-2">
                <GhostButton
                  onClick={copyErrorToClipboard}
                  className="flex items-center"
                >
                  <ClipboardIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span>Copy output</span>
                </GhostButton>

                <GhostButton
                  onClick={() => {
                    ideMessenger.post("toggleDevTools", undefined);
                  }}
                  className="flex items-center"
                >
                  <ArrowTopRightOnSquareIcon className="mr-1.5 h-4 w-4" />
                  <span className="text-xs">View Logs</span>
                </GhostButton>
              </div>
            </div>
          </ToggleDiv>
        </div>
      )}

      <div>
        <span className="text-base font-medium">Report this error</span>
        <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              const issueTitle = `Error: ${selectedModel?.title || "Model"} - ${statusCode || "Unknown error"}`;
              const issueBody = `**Error Details**

Model: ${selectedModel?.title || "Unknown"}
Provider: ${selectedModel?.underlyingProviderName || "Unknown"}
Status Code: ${statusCode || "N/A"}

**Error Output**
\`\`\`
${parsedError}
\`\`\`

**Additional Context**
Please add any additional context about the error here
`;
              const url = `https://github.com/continuedev/continue/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
              ideMessenger.post("openUrl", url);
            }}
          >
            <GithubIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Open GitHub issue</span>
          </GhostButton>
          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              ideMessenger.post("openUrl", DISCUSSIONS_LINK);
            }}
          >
            <GithubIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Discussions</span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
};

export default StreamErrorDialog;

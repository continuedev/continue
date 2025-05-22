import { LocalModelSize } from "core";
import {
  DEFAULT_MODEL_GRANITE_LARGE,
  DEFAULT_MODEL_GRANITE_SMALL
} from "core/config/default";
import { DEFAULT_MODEL_INFO } from "core/granite/commons/modelInfo";
import { ProgressData } from "core/granite/commons/progressData";
import { ServerState } from "core/granite/commons/serverState";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";
import { shouldRecommendLargeModel, SystemInfo } from "core/granite/commons/sysInfo";
import { formatSize } from "core/granite/commons/textUtils";
import { checkMinimumServerVersion, MIN_OLLAMA_VERSION } from "core/granite/commons/versions";
import {
  FINAL_STEP,
  MODELS_STEP,
  OLLAMA_STEP,
  WizardState,
} from "core/granite/commons/wizardState";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { VSCodeButton } from "../components/VSCodeButton";
import { DiagnosticMessage } from "./DiagnosticMessage";
import { ProgressBlock } from "./ProgressBlock";
import { StatusCheck } from "./StatusCheck";

interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

interface InstallationMode {
  id: string;
  label: string;
  supportsRefresh: boolean;
}

enum WizardStatus {
  idle,
  downloadingOllama,
  startingOllama,
  downloadingModel,
}

interface WizardContextProps {
  currentStatus: WizardStatus;
  setCurrentStatus: React.Dispatch<React.SetStateAction<WizardStatus>>;
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  stepStatuses: boolean[];
  setStepStatuses: React.Dispatch<React.SetStateAction<boolean[]>>;
  serverState: ServerState;
  setServerState: React.Dispatch<React.SetStateAction<ServerState>>;
  systemInfo: SystemInfo | null;
  setSystemInfo: React.Dispatch<React.SetStateAction<SystemInfo | null>>;
  installationModes: InstallationMode[];
  setInstallationModes: React.Dispatch<
    React.SetStateAction<InstallationMode[]>
  >;
  preselectedModel: LocalModelSize;
  setPreselectedModel: React.Dispatch<React.SetStateAction<LocalModelSize>>;
  selectedModel: LocalModelSize;
  setSelectedModel: React.Dispatch<React.SetStateAction<LocalModelSize>>;
  statusByModel: Map<string, ModelStatus>;
  setStatusByModel: React.Dispatch<
    React.SetStateAction<Map<string, ModelStatus>>
  >;
  modelInstallationProgress: number;
  setModelInstallationProgress: React.Dispatch<React.SetStateAction<number>>;
  modelInstallationError: string | undefined;
  setModelInstallationError: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  modelInstallationStatus: "idle" | "downloading" | "complete";
  setModelInstallationStatus: React.Dispatch<
    React.SetStateAction<"idle" | "downloading" | "complete">
  >;
  isOffline: boolean;
  setIsOffline: React.Dispatch<React.SetStateAction<boolean>>;
  ollamaInstallationProgress: number;
  setOllamaInstallationProgress: React.Dispatch<React.SetStateAction<number>>;
  ollamaInstallationError: string | undefined;
  setOllamaInstallationError: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  isVisible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isOllamaOutdated: boolean;
  setOllamaOutdated: React.Dispatch<React.SetStateAction<boolean>>;
}

const WizardContext = createContext<WizardContextProps | undefined>(undefined);

export const useWizardContext = (): WizardContextProps => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizardContext must be used within a WizardProvider");
  }
  return context;
};

interface WizardProviderProps {
  children: ReactNode;
}

export const WizardProvider: React.FC<WizardProviderProps> = ({ children }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<WizardStatus>(
    WizardStatus.idle,
  );
  const [stepStatuses, setStepStatuses] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [serverState, setServerState] = useState<ServerState>({
      status: ServerStatus.unknown,
      version: undefined
    });

  const [statusByModel, setStatusByModel] = useState<Map<string, ModelStatus>>(
    new Map(),
  );
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [installationModes, setInstallationModes] = useState<
    InstallationMode[]
  >([]);
  const [preselectedModel, setPreselectedModel] =
    useState<LocalModelSize>("small");
  const [selectedModel, setSelectedModel] =
    useState<LocalModelSize>(preselectedModel);
  const [modelInstallationProgress, setModelInstallationProgress] =
    useState<number>(0);
  const [modelInstallationError, setModelInstallationError] = useState<
    string | undefined
  >();
  const [ollamaInstallationProgress, setOllamaInstallationProgress] =
    useState<number>(0);
  const [ollamaInstallationError, setOllamaInstallationError] = useState<
    string | undefined
  >();
  const [modelInstallationStatus, setModelInstallationStatus] = useState<
    "idle" | "downloading" | "complete"
  >("idle");
  const [isOffline, setIsOffline] = useState(false);
  const [isVisible, setVisible] = useState(true);
  const [isOllamaOutdated, setOllamaOutdated] = useState(false);

  return (
    <WizardContext.Provider
      value={{
        currentStatus,
        setCurrentStatus,
        activeStep,
        setActiveStep,
        stepStatuses,
        setStepStatuses,
        serverState,
        setServerState,
        systemInfo,
        setSystemInfo,
        installationModes,
        setInstallationModes,
        preselectedModel,
        setPreselectedModel,
        selectedModel,
        setSelectedModel,
        statusByModel,
        setStatusByModel,
        modelInstallationProgress,
        setModelInstallationProgress,
        modelInstallationStatus,
        setModelInstallationStatus,
        ollamaInstallationProgress,
        setOllamaInstallationProgress,
        ollamaInstallationError,
        setOllamaInstallationError,
        isOffline,
        setIsOffline,
        modelInstallationError,
        setModelInstallationError,
        isVisible,
        setVisible,
        isOllamaOutdated,
        setOllamaOutdated
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

interface StepProps {
  isActive: boolean;
  onClick?: () => void;
  status: boolean;
  title: string;
  children?: React.ReactNode;
}

const WizardStep: React.FC<StepProps> = ({
  isActive,
  onClick,
  status,
  title,
  children,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onClick?.();
    }
  };

  return (
    <div
      className={`mb-[1px] rounded-md p-4 transition-colors duration-100 ease-in-out ${
        isActive
          ? "border border-[var(--vscode-welcomePage-tileBorder)] bg-[var(--vscode-welcomePage-tileBackground)]"
          : "hover:bg-[var(--vscode-welcomePage-tileHoverBackground,rgba(255,255,255,0.04))]"
      }`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
    >
      <div>
        <div className="flex cursor-pointer items-center">
          <StatusCheck
            type={status ? "complete" : isActive ? "active" : "missing"}
          />
          <h3
            className={`m-0 ml-3 text-sm font-semibold leading-[1.4] ${
              isActive
                ? "text-[var(--vscode-peekViewTitleLabel-foreground)]"
                : "text-[var(--vscode-descriptionForeground)]"
            }`}
          >
            {title}
          </h3>
        </div>
        {isActive && <div className="ml-7">{children}</div>}
      </div>
    </div>
  );
};

const OllamaInstallStep: React.FC<StepProps> = (props) => {
  const {
    serverState,
    installationModes,
    currentStatus,
    setCurrentStatus,
    isOffline,
    ollamaInstallationError,
    ollamaInstallationProgress,
    setOllamaInstallationProgress,
    isOllamaOutdated
  } = useWizardContext();
  const [systemErrors, setSystemErrors] = useState<string[] | undefined>();
  const serverStatus = serverState.status;
  const hiddenLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    //cancel download on error
    if (ollamaInstallationError || isOffline) {
      cancelDownload();
    }
  }, [ollamaInstallationError, isOffline]);

  useEffect(() => {
    const ollamaVersion = serverState.version;
    const sysErrors = [];
    if (isOllamaOutdated) {
      sysErrors.push(
        `Ollama v${MIN_OLLAMA_VERSION} is required. Version ${ollamaVersion} is detected`,
      );
    }
    setSystemErrors(sysErrors);
  }, [serverState.version]);

  const handleDownload = () => {
    setCurrentStatus(WizardStatus.downloadingOllama);
    vscode.postMessage({
      command: "installOllama",
      data: {
        mode: installationModes[0].id,
      },
    });
  };

  const cancelDownload = () => {
    vscode.postMessage({
      command: "cancelInstallation",
      data: {
        target: "ollama",
      },
    });
    setCurrentStatus(WizardStatus.idle);
    setOllamaInstallationProgress(0);
  };


  const isDevspaces = installationModes.length > 0 && installationModes[0].id === "devspaces";

  let serverButton;
  if (
    !isOllamaOutdated && (
    serverStatus === ServerStatus.started ||
    serverStatus === ServerStatus.stopped
  )) {
    serverButton = (
      <VSCodeButton variant="secondary" disabled>
        Complete!
      </VSCodeButton>
    );
  } else if (isDevspaces) {
    const hiddenLink = // Trick to open the link directly, avoiding calling VS Code API, which would show a security warning
      (
        <a
          ref={hiddenLinkRef}
          href="https://developers.redhat.com/articles/2024/08/12/integrate-private-ai-coding-assistant-ollama"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden"
        >
          Red Hat Dev Spaces Installation Guide
        </a>
      );
    serverButton = (
      <>
        {hiddenLink}
        <VSCodeButton onClick={() => hiddenLinkRef.current?.click()}>
          Installation Guide
        </VSCodeButton>
      </>
    );
  } else if (installationModes.length > 0) {
    serverButton = (
      <VSCodeButton
        onClick={handleDownload}
        disabled={isOffline}
        title={installationModes[0].label}
      >
        Download and {isOllamaOutdated?"Update":"Install"} Ollama
      </VSCodeButton>
    );
  }

  return (
    <WizardStep {...props}>
      <div className="mt-4">
        <p className="text-sm text-[--vscode-editor-foreground]">
          Ollama is an open source tool that allows running AI models locally.
          It is required by Granite.Code.
        </p>
        {isDevspaces && (
          <p className="text-sm text-[--vscode-editor-foreground]">
            Follow the guide to install Ollama on Red Hat Dev Spaces.
          </p>
        )}

        {currentStatus !== WizardStatus.downloadingOllama && serverButton}

        {currentStatus === WizardStatus.downloadingOllama &&
          installationModes[0]?.id === "windows" && (
            <div className="mt-4 flex items-center gap-2">
              <VSCodeButton variant="secondary" onClick={cancelDownload}>
                Cancel
              </VSCodeButton>
              <ProgressBlock progress={ollamaInstallationProgress} />
            </div>
          )}
        {!isDevspaces && installationModes.length > 0 && (
          <p className="text-sm text-[--vscode-editor-foreground]">
            If you prefer, you can also
            {!isOllamaOutdated &&
             <a href="https://ollama.com/download"> install Ollama manually</a>}
            {isOllamaOutdated &&
            <a href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-upgrade-ollama"> update Ollama manually</a>
            }.
          </p>
        )}
        {systemErrors?.map((systemError) => (
            <DiagnosticMessage key={systemError} message={systemError} type="error" />
        ))}
        {!isDevspaces && isOffline && (
          <DiagnosticMessage
            type="info"
            message="Network connection required"
          />
        )}
      </div>
    </WizardStep>
  );
};

const ModelSelectionStep: React.FC<StepProps> = (props) => {
  const {
    serverState,
    selectedModel,
    modelInstallationProgress,
    setModelInstallationProgress,
    modelInstallationStatus,
    setModelInstallationStatus,
    isOffline,
    modelInstallationError,
    setModelInstallationError,
    systemInfo,
    statusByModel,
    isOllamaOutdated
  } = useWizardContext();
  const [systemErrors, setSystemErrors] = useState<string[] | undefined>();

  const startDownload = () => {
    setModelInstallationError(undefined);
    setModelInstallationStatus("downloading");
    vscode.postMessage({
      command: "installModels",
      data: {
        model: selectedModel,
      },
    });
  };

  const cancelDownload = () => {
    vscode.postMessage({
      command: "cancelInstallation",
      data: {
        target: "models",
      },
    });
    setModelInstallationStatus("idle");
    setModelInstallationProgress(0);
  };

  useEffect(() => {
    //cancel download on error
    if (modelInstallationError || isOffline) {
      cancelDownload();
    }
  }, [modelInstallationError, isOffline]);

  useEffect(() => {
    const sysErrors = [];
    if (systemInfo && systemInfo.diskSpace) {
      const { freeDiskSpace } = systemInfo.diskSpace;
      const requiredDiskSpace = getRequiredSpace(selectedModel, statusByModel);
      if (freeDiskSpace < requiredDiskSpace) {
        sysErrors.push(
          `Insufficient disk space available: ${formatSize(freeDiskSpace)} free, ${formatSize(requiredDiskSpace)} required.`,
        );
      }
    }
    const ollamaVersion = serverState.version;
    if (isOllamaOutdated) {
      sysErrors.push(
        `Ollama v${MIN_OLLAMA_VERSION} is required. Version ${ollamaVersion} is detected`,
      );
    }
    setSystemErrors(sysErrors);
  }, [systemInfo, selectedModel, statusByModel, serverState.version]);

  const serverStatus = serverState.status;

  return (
    <WizardStep {...props}>
      {props.isActive && (
        <div className="mt-4">
          <p className="text-sm text-[--vscode-editor-foreground]">
            Setup will download Granite AI models.<br/>
            Download size: {formatSize(getRequiredSpace(selectedModel, statusByModel))}.
          </p>

          <div className="mt-4 flex items-center gap-2">
            {modelInstallationStatus === "idle" && (
              <VSCodeButton
                onClick={startDownload}
                disabled={
                  isOffline ||
                  (systemErrors && systemErrors.length > 0) ||
                  (serverStatus !== ServerStatus.started &&
                    serverStatus !== ServerStatus.stopped)
                }
                variant="primary"
              >
                Download Model
              </VSCodeButton>
            )}
            {modelInstallationStatus === "complete" && (
              <VSCodeButton disabled={true} variant="secondary">
                Complete!
              </VSCodeButton>
            )}
            {modelInstallationStatus === "downloading" && (
              <>
                <VSCodeButton variant="secondary" onClick={cancelDownload}>
                  Cancel
                </VSCodeButton>

                <ProgressBlock progress={modelInstallationProgress} />
              </>
            )}
          </div>

          {systemErrors?.map((systemError) => (
            <DiagnosticMessage key={systemError} message={systemError} type="error" />
          ))}
          {modelInstallationError && (
            <DiagnosticMessage message={modelInstallationError} type="error" />
          )}
          {serverStatus !== ServerStatus.started &&
            serverStatus !== ServerStatus.stopped && (
              <DiagnosticMessage
                type="warning"
                message="Ollama must be installed"
              />
            )}
          {serverStatus === ServerStatus.stopped && !isOllamaOutdated && (
            <DiagnosticMessage
              type="info"
              message="Ollama will be started automatically"
            />
          )}
          {isOffline && (
            <DiagnosticMessage
              type="info"
              message="Network connection required"
            />
          )}
        </div>
      )}
    </WizardStep>
  );
};

const StartLocalAIStep: React.FC<StepProps> = (props) => {
  const handleShowTutorial = async () => {
    console.log("show tutorial");
    vscode.postMessage({
      command: "showTutorial",
    });
  };
  return (
    <WizardStep {...props}>
      {props.isActive && (
        <div className="mt-4">
          <p className="text-sm text-[--vscode-editor-foreground]">
            Granite.Code is ready to be used. Try the tutorial to get started.
          </p>
          <VSCodeButton className="mt-4" onClick={handleShowTutorial}>
            Open Tutorial
          </VSCodeButton>
        </div>
      )}
    </WizardStep>
  );
};

export const GraniteWizard: React.FC = () => {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
};

const WizardContent: React.FC = () => {

  const {
    currentStatus,
    setCurrentStatus,
    activeStep,
    setActiveStep,
    stepStatuses,
    setStepStatuses,
    setServerState,
    setSystemInfo,
    setInstallationModes,
    setPreselectedModel,
    preselectedModel,
    setSelectedModel,
    setModelInstallationProgress,
    setModelInstallationError,
    modelInstallationStatus,
    setModelInstallationStatus,
    setIsOffline,
    setOllamaInstallationProgress,
    setOllamaInstallationError,
    setStatusByModel,
    isVisible,
    setVisible,
    setOllamaOutdated
  } = useWizardContext();
  const currentStatusRef = useRef(currentStatus);
  const isVisibleRef = useRef(isVisible);
  const modelInstallationStatusRef = useRef(modelInstallationStatus);
  const requestStatus = () => {
    if(!isVisibleRef.current) {
      return;
    }

    vscode.postMessage({
      command: "fetchStatus",
    });
  }

  const init = () => {
    vscode.postMessage({
      command: "init",
    });
  }

  // Update ref when currentStatus changes
  useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    modelInstallationStatusRef.current = modelInstallationStatus;
  }, [modelInstallationStatus]);

  // Update ref when visibility changes
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  const REFETCH_MODELS_INTERVAL_MS = 1500;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      const command: string | undefined = payload.command;
      if (!command) {
        return;
      }
      const currStatus = currentStatusRef.current;
      switch (command) {
        case "visibilityChange":
          setVisible(payload.data.isVisible);
          break;
        case "init": {
          const data = payload.data;
          setInstallationModes(data.installModes);
          const sysinfo = data.systemInfo as SystemInfo;
          setSystemInfo(sysinfo);
          const preselectedModel = shouldRecommendLargeModel(sysinfo)
            ? "large"
            : "small";
          setPreselectedModel(preselectedModel);
          setSelectedModel("large");
          const wizardState = data.wizardState as WizardState | undefined;
          if (wizardState?.stepStatuses) {
            setStepStatuses(wizardState.stepStatuses);
          }

          break;
        }
        case "status": {
          const data = payload.data;
          const newServerState = data.serverState;
          const newVersion: string | undefined = newServerState.version;
          const isOllamaOutdated = newVersion !== undefined && !checkMinimumServerVersion(newVersion);
          setOllamaOutdated(isOllamaOutdated);
          setServerState(newServerState);

          const modelStatusMap = new Map<string, ModelStatus>(Object.entries(data.statusByModel));
          setStatusByModel(modelStatusMap);

          const newStepStatuses = data.wizardState.stepStatuses as boolean[];
          setStepStatuses((prevStatuses) => {
            const ollamaStepChanged = prevStatuses[OLLAMA_STEP] !== newStepStatuses[OLLAMA_STEP];
            const modelsStepChanged = prevStatuses[MODELS_STEP] !== newStepStatuses[MODELS_STEP];

            if (ollamaStepChanged) {
              if (!newStepStatuses[OLLAMA_STEP]) {
                //Ollama was just uninstalled/downgraded, return to the Ollama step
                setActiveStep(OLLAMA_STEP);
              } else if (!newStepStatuses[MODELS_STEP]) {
                setActiveStep(MODELS_STEP);
              }
            }
            if (newStepStatuses[MODELS_STEP]) {
              setModelInstallationProgress(100);
              setModelInstallationStatus("complete");
              if (!newStepStatuses[FINAL_STEP] && modelsStepChanged && !isOllamaOutdated) {
                setActiveStep(FINAL_STEP);
              }
            } else if (modelsStepChanged && modelInstallationStatusRef.current === "complete") {
              // Model installation was complete, and then some model was uninstalled
              // Reset the progress and status to allow the user to start the installation again
              setModelInstallationProgress(0);
              setModelInstallationStatus("idle");
              setActiveStep(MODELS_STEP);
            }

            return newStepStatuses;
          });
          if (
            (newStepStatuses[OLLAMA_STEP] && currStatus === WizardStatus.downloadingOllama) ||
            currStatus === WizardStatus.startingOllama
          ) {
            setCurrentStatus(WizardStatus.idle);
          }
          break;
        }
        case "modelInstallationProgress": {
          const progress = payload.data?.progress as ProgressData | undefined;
          if (progress && progress.total) {
            const progressPercentage =
              ((progress.completed ?? 0) / progress.total) * 100;
            setModelInstallationProgress(Math.min(progressPercentage, 99.99)); // Don't show 100% completion until it's actually done
          }
          const error = payload.data?.error as string | undefined;
          if (error) {
            console.error("Model installation error: " + error);
            setModelInstallationProgress(0);
            setModelInstallationError(
              "Unable to install the Granite Model: " + error,
            );
          }
          break;
        }
        case "ollamaInstallationProgress": {
          const progress = payload.data?.progress as ProgressData | undefined;
          if (progress && progress.total) {
            const progressPercentage =
              ((progress.completed ?? 0) / progress.total) * 100;
            console.log("Ollama installation progress: " + progressPercentage);
            setOllamaInstallationProgress(Math.min(progressPercentage, 99.99)); // Don't show 100% completion until it's actually done
          }
          const error = payload.data?.error as string | undefined;
          if (error) {
            console.error("Ollama installation error: " + error);
            setOllamaInstallationProgress(0);
            setOllamaInstallationError("Unable to install Ollama: " + error);
            //TODO Cancel download
          }
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    init(); // fetch system info once //FIXME diskspace can vary over time, might be moved to requestStatus()
    requestStatus(); // check ollama and models statuses
    const intervalId = setInterval(
      //Poll for ollama and models status updates
      requestStatus,
      REFETCH_MODELS_INTERVAL_MS,
    );
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    const checkOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener("online", checkOnlineStatus);
    window.addEventListener("offline", checkOnlineStatus);
    checkOnlineStatus(); // Initial check

    return () => {
      window.removeEventListener("online", checkOnlineStatus);
      window.removeEventListener("offline", checkOnlineStatus);
    };
  }, []);

  const steps = [
    { component: OllamaInstallStep, title: "Download and install Ollama" },
    { component: ModelSelectionStep, title: "Download Granite" },
    { component: StartLocalAIStep, title: "Start using local AI" },
  ];

  return (
    <div className="h-full w-full" role="tablist">
      {/* Main container with responsive layout */}
      <div className="mx-10 max-w-[1400px] px-10 pt-1 md:px-16 md:pt-6">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Left panel with text and steps */}
          <div className="max-w-[600px] flex-1">
            <h2 className="mb-2 text-3xl font-normal text-[--vscode-foreground]">
              Granite.Code Setup
            </h2>
            <p className="mb-4 text-[--vscode-descriptionForeground]">
              Welcome to Granite.Code! Follow the steps below to start using local AI coding assistance.
            </p>
            <p className="mb-4 text-[--vscode-descriptionForeground]">
              For a good experience, an Apple Silicon Mac or a GPU with at least 10&#x200A;GB of video memory is required.
            </p>
            {preselectedModel !== "large" && (
              <p className="mb-4 text-[--vscode-editorWarning-foreground]">
              Warning : this device's hardware does not meet the minimum requirements.
            </p>
            )}

            <div className="space-y-[1px]">
              {steps.map((step, index) => {
                const StepComponent = step.component;
                return (
                  <StepComponent
                    key={step.title}
                    status={stepStatuses[index]}
                    isActive={activeStep === index}
                    title={step.title}
                    onClick={() => setActiveStep(index)}
                  />
                );
              })}
            </div>
          </div>

          {/* Right panel with image */}
          {/*TODO make the image resize before being moved down*/}
          <div className="flex flex-1 justify-center">
            <img
              src={`${window.vscMediaUrl}/granite/step_${activeStep + 1}.svg`}
              alt={`Step ${activeStep + 1} illustration`}
              className="h-auto max-h-[400px] max-w-full object-contain opacity-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function getRequiredSpace(
  selectedModel: LocalModelSize,
  statusByModel: Map<string, ModelStatus>,
): number {
  const graniteModel =
    selectedModel === "large"
      ? DEFAULT_MODEL_GRANITE_LARGE
      : DEFAULT_MODEL_GRANITE_SMALL;
  const models: string[] = [graniteModel.model, "nomic-embed-text:latest"];
  let missingModels = models
    .filter((model) => statusByModel.get(model) !== ModelStatus.installed);

  // If the user clicks back to a skipped download step, we want to show entire download size, not 0B
  if (missingModels.length === 0) {
    missingModels = models;
  }

  return missingModels
    .reduce((sum, model) => {
      const modelInfo = DEFAULT_MODEL_INFO.get(model); //FIXME get from registry
      return sum + (modelInfo ? modelInfo.size : 0);
    }, 0);
}

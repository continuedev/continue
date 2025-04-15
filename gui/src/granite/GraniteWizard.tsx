import { RadioGroup } from "@headlessui/react";
import { LocalModelSize } from "core";
import {
  DEFAULT_MODEL_GRANITE_LARGE,
  DEFAULT_MODEL_GRANITE_SMALL,
} from "core/config/default";
import { DEFAULT_MODEL_INFO } from "core/granite/commons/modelInfo";
import { MODEL_REQUIREMENTS } from "core/granite/commons/modelRequirements";
import { ProgressData } from "core/granite/commons/progressData";
import { GB } from "core/granite/commons/sizeUtils";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";
import { isHighEndApple, shouldRecommendLargeModel, SystemInfo } from "core/granite/commons/sysInfo";
import { formatSize } from "core/granite/commons/textUtils";
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
  serverStatus: ServerStatus;
  setServerStatus: React.Dispatch<React.SetStateAction<ServerStatus>>;
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
  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    ServerStatus.unknown,
  );
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

  return (
    <WizardContext.Provider
      value={{
        currentStatus,
        setCurrentStatus,
        activeStep,
        setActiveStep,
        stepStatuses,
        setStepStatuses,
        serverStatus,
        setServerStatus,
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
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

interface ModelOption {
  key: LocalModelSize;
  name: string;
  description: string;
}

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
    serverStatus,
    installationModes,
    currentStatus,
    setCurrentStatus,
    isOffline,
    ollamaInstallationError,
    ollamaInstallationProgress,
    setOllamaInstallationProgress,
  } = useWizardContext();

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

  useEffect(() => {
    //cancel download on error
    if (ollamaInstallationError || isOffline) {
      cancelDownload();
    }
  }, [ollamaInstallationError, isOffline]);

  const isDevspaces =
    installationModes.length > 0 && installationModes[0].id === "devspaces";

  let serverButton;

  if (
    serverStatus === ServerStatus.started ||
    serverStatus === ServerStatus.stopped
  ) {
    serverButton = (
      <VSCodeButton variant="secondary" disabled>
        Complete!
      </VSCodeButton>
    );
  } else if (isDevspaces) {
    const hiddenLinkRef = useRef<HTMLAnchorElement>(null);
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
        Download and Install Ollama
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

        {currentStatus === WizardStatus.downloadingOllama && (
          <div className="mt-4 flex items-center gap-2">
            <VSCodeButton variant="secondary" onClick={cancelDownload}>
              Cancel
            </VSCodeButton>
            not here
            <ProgressBlock progress={ollamaInstallationProgress} />
          </div>
        )}

        {!isDevspaces && installationModes.length > 0 && (
          <p className="text-sm text-[--vscode-editor-foreground]">
            If you prefer, you can also{" "}
            <a href="https://ollama.com/download">install Ollama manually</a>.
          </p>
        )}
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
    serverStatus,
    preselectedModel,
    selectedModel,
    setSelectedModel,
    modelInstallationProgress,
    setModelInstallationProgress,
    modelInstallationStatus,
    setModelInstallationStatus,
    isOffline,
    modelInstallationError,
    setModelInstallationError,
    systemInfo,
    statusByModel,
  } = useWizardContext();
  const [systemError, setSystemError] = useState<string | undefined>();

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

  const handleModelChange = (value: LocalModelSize) => {
    setSelectedModel(value);
    vscode.postMessage({
      command: "selectModels",
      data: {
        model: value,
      },
    });
  };

  useEffect(() => {
    //cancel download on error
    if (modelInstallationError || isOffline) {
      cancelDownload();
    }
  }, [modelInstallationError, isOffline]);

  useEffect(() => {
    if (systemInfo && systemInfo.diskSpace) {
      const { freeDiskSpace } = systemInfo.diskSpace;
      const requiredDiskSpace = getRequiredSpace(selectedModel, statusByModel);
      if (freeDiskSpace < requiredDiskSpace) {
        setSystemError(
          `Insufficient disk space available: ${formatSize(freeDiskSpace)} free, ${formatSize(requiredDiskSpace)} required.`,
        );
      } else {
        setSystemError(undefined);
      }
    }
  }, [systemInfo, selectedModel, statusByModel]);

  const recommendedMemoryThreshold = MODEL_REQUIREMENTS[DEFAULT_MODEL_GRANITE_LARGE.model].recommendedMemoryBytes / GB;
  const modelOptions: ModelOption[] = [
    {
      key: "large",
      name: "Large",
      description: `For machines with ${recommendedMemoryThreshold}GB of ${
        systemInfo && isHighEndApple(systemInfo.gpus)
          ? "system memory"
          : "video memory and a high-performance GPU"
      }`,
    },
    {
      key: "small",
      name: "Small",
      description: `For machines with less than ${recommendedMemoryThreshold}GB of ${
        systemInfo && isHighEndApple(systemInfo.gpus)
          ? "system memory"
          : "video memory and a lower-performance GPU"
      }`,
    },
  ];

  return (
    <WizardStep {...props}>
      {props.isActive && (
        <div className="mt-4">
          <p className="text-sm text-[--vscode-editor-foreground]">
            Select which model you want to use. You can change this preference
            in the settings.
          </p>
          <RadioGroup
            value={selectedModel}
            onChange={handleModelChange}
            className="mt-4"
            disabled={modelInstallationStatus !== "idle"}
          >
            <div className="space-y-4">
              {modelOptions.map((option) => (
                <RadioGroup.Option
                  key={option.key}
                  value={option.key}
                  className="relative flex cursor-pointer rounded focus:outline-none"
                >
                  {({ checked }) => (
                    <div className="mt-1 flex w-full items-start">
                      <input
                        type="radio"
                        checked={checked}
                        readOnly
                        className="mt-2 h-4 w-4 border border-[--vscode-editor-foreground] bg-transparent focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="ml-3 space-y-1">
                        <RadioGroup.Label className="font-bold text-[--vscode-editor-foreground]">
                          {option.name}
                        </RadioGroup.Label>
                        <RadioGroup.Description className="text-sm leading-normal text-[--vscode-editor-foreground] opacity-80">
                          {option.description}
                        </RadioGroup.Description>
                        {option.key === preselectedModel && option.key === "large" && (
                          <p className="text-sm leading-normal text-[--vscode-editorWarning-foreground,#ddb100]">
                            Recommended for your machine
                          </p>
                        )}
                        {option.key === "large" && option.key !== preselectedModel && selectedModel === "large" && (
                          <p className="text-sm leading-normal text-[--vscode-errorForeground]">
                            Not recommended for your machine
                          </p>
                        )}
                        {option.key === "small" && selectedModel === "small" && (
                          <p className="text-sm leading-normal text-[--vscode-errorForeground]">
                            Limited capabilities, for experimentation only
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </RadioGroup.Option>
              ))}
            </div>
          </RadioGroup>

          <div className="mt-4 flex items-center gap-2">
            {modelInstallationStatus === "idle" && (
              <VSCodeButton
                onClick={startDownload}
                disabled={
                  isOffline ||
                  systemError !== undefined ||
                  (serverStatus !== ServerStatus.started &&
                    serverStatus !== ServerStatus.stopped)
                }
                variant="primary"
              >
                Download
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

          {systemError && (
            <DiagnosticMessage message={systemError} type="error" />
          )}
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
          {serverStatus === ServerStatus.stopped && (
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
            Granite.Code is ready to be used
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

function requestStatus(): void {
  vscode.postMessage({
    command: "fetchStatus",
  });
}

function init(): void {
  vscode.postMessage({
    command: "init",
  });
}

const WizardContent: React.FC = () => {
  const {
    currentStatus,
    setCurrentStatus,
    activeStep,
    setActiveStep,
    stepStatuses,
    setStepStatuses,
    setServerStatus,
    setSystemInfo,
    setInstallationModes,
    setPreselectedModel,
    setSelectedModel,
    setModelInstallationProgress,
    setModelInstallationError,
    setModelInstallationStatus,
    setIsOffline,
    setOllamaInstallationProgress,
    setOllamaInstallationError,
    setStatusByModel,
  } = useWizardContext();
  const currentStatusRef = useRef(currentStatus);

  // Update ref when currentStatus changes
  useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

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
        case "init": {
          const data = payload.data;
          setInstallationModes(data.installModes);
          const sysinfo = data.systemInfo as SystemInfo;
          setSystemInfo(sysinfo);
          const preselectedModel = shouldRecommendLargeModel(sysinfo)
            ? "large"
            : "small";
          setPreselectedModel(preselectedModel);
          const wizardState = data.wizardState as WizardState | undefined;
          if (wizardState) {
            if (wizardState?.selectedModelSize) {
              setSelectedModel(wizardState.selectedModelSize);
            } else {
              setSelectedModel(preselectedModel);
            }
            if (wizardState?.stepStatuses) {
              setStepStatuses(wizardState.stepStatuses);
            }
          } else {
            setSelectedModel(preselectedModel);
          }

          break;
        }
        case "status": {
          const data = payload.data;
          setServerStatus(data.serverStatus);
          const newStepStatuses = data.wizardState.stepStatuses as boolean[];
          setStepStatuses((prevStatuses) => {
            if (
              newStepStatuses[OLLAMA_STEP] &&
              !newStepStatuses[MODELS_STEP] &&
              prevStatuses[OLLAMA_STEP] != newStepStatuses[OLLAMA_STEP]
            ) {
              setActiveStep(MODELS_STEP);
            }
            if (newStepStatuses[MODELS_STEP]) {
              setModelInstallationProgress(100);
              setModelInstallationStatus("complete");
              if (
                !newStepStatuses[FINAL_STEP] &&
                prevStatuses[MODELS_STEP] != newStepStatuses[MODELS_STEP]
              ) {
                setActiveStep(FINAL_STEP);
              }
            }
            return newStepStatuses;
          });
          const modelStatusMap = new Map(Object.entries(data.statusByModel));
          setStatusByModel(modelStatusMap as Map<string, ModelStatus>);
          if (
            (newStepStatuses[OLLAMA_STEP] &&
              currStatus === WizardStatus.downloadingOllama) ||
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
    { component: ModelSelectionStep, title: "Download a Granite model" },
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
              Granite.Code
            </h2>
            <h2 className="mb-1 text-2xl font-light text-[--vscode-foreground]">
              Local AI setup
            </h2>
            <p className="mb-8 text-[--vscode-descriptionForeground]">
              Follow these simple steps to start using local AI.
            </p>

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
  return models
    .filter((model) => statusByModel.get(model) === ModelStatus.missing)
    .reduce((sum, model) => {
      const modelInfo = DEFAULT_MODEL_INFO.get(model); //FIXME get from registry
      return sum + (modelInfo ? modelInfo.size : 0);
    }, 0);
}

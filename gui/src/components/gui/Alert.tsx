import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { ReactNode } from "react";
import { vscBackground } from "..";

type AlertTypes = "info" | "success" | "warning" | "error";

export interface AlertProps {
  children?: ReactNode;
  type?: AlertTypes;
}

type AlertConfig = {
  [key in AlertTypes]: {
    Icon: any;
  };
};

const ALERT_CONFIGS: AlertConfig = {
  info: {
    Icon: InformationCircleIcon,
  },
  success: {
    Icon: CheckCircleIcon,
  },
  warning: {
    Icon: ExclamationTriangleIcon,
  },
  error: {
    Icon: ExclamationCircleIcon,
  },
};

function Alert({ children, type = "info" }: AlertProps) {
  const { Icon } = ALERT_CONFIGS[type];

  return (
    <div className="rounded-lg border-l-4 bg-[color:var(--vscode-editor-foreground)] p-4 opacity-70 shadow-none">
      <div className="flex items-start">
        <Icon
          className="h-6 min-h-5 w-6 min-w-5"
          style={{ color: vscBackground }}
        />

        <div className="ml-3" style={{ color: vscBackground }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Alert;

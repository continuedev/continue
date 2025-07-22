import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { ReactNode } from "react";
import { vscBackground } from "..";

type AlertTypes = "info" | "success" | "warning" | "error";
type AlertSize = "sm" | "lg";

export interface AlertProps {
  children?: ReactNode;
  type?: AlertTypes;
  size?: AlertSize;
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

const alertSizes = {
  sm: "px-2 py-1.5 rounded border-l-2",
  lg: "px-4 py-3 rounded-lg border-l-4",
};

const iconSizes = {
  sm: "h-3 w-3",
  lg: "h-5 w-5",
};

const spacingSizes = {
  sm: "ml-1.5",
  lg: "ml-3",
};

function Alert({ children, type = "info", size = "lg" }: AlertProps) {
  const { Icon } = ALERT_CONFIGS[type];

  return (
    <div
      className={`bg-editor-foreground opacity-70 shadow-none ${alertSizes[size]}`}
    >
      <div className="flex items-center">
        <Icon
          className={`flex-shrink-0 ${iconSizes[size]}`}
          style={{ color: vscBackground }}
        />

        <div className={spacingSizes[size]} style={{ color: vscBackground }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Alert;

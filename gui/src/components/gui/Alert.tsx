import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import { ReactNode } from "react";

type AlertTypes = "info" | "success" | "warning" | "error";

export interface AlertProps {
  children?: ReactNode;
  type?: AlertTypes;
}

type AlertConfig = {
  [key in AlertTypes]: {
    bgColor: string;
    Icon: any;
  };
};

const ALERT_CONFIGS: AlertConfig = {
  info: {
    bgColor: "bg-blue-400",
    Icon: InformationCircleIcon,
  },
  success: {
    bgColor: "bg-green-400",
    Icon: CheckCircleIcon,
  },
  warning: {
    bgColor: "bg-yellow-400",
    Icon: ExclamationTriangleIcon,
  },
  error: {
    bgColor: "bg-red-400",
    Icon: ExclamationCircleIcon,
  },
};

function Alert({ children, type = "info" }: AlertProps) {
  const { bgColor, Icon } = ALERT_CONFIGS[type];

  return (
    <div
      className={`py-2 px-4 rounded-lg drop-shadow-none ${bgColor} border-l-4`}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="w-6 h-6 text-blue-700" />
        </div>
        <div className="ml-3">
          <p className={`text-sm text-slate-800`}>{children}</p>
        </div>
      </div>
    </div>
  );
}

export default Alert;

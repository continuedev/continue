import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import { cn } from "../../util/cn";

type AlertTypes = "info" | "success" | "warning" | "error";
type AlertSize = "sm" | "lg";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: AlertTypes;
  size?: AlertSize;
}

type AlertConfig = {
  [key in AlertTypes]: {
    Icon: any;
    iconColor: string;
    background: string;
    border: string;
    text: string;
  };
};

const ALERT_CONFIGS: AlertConfig = {
  info: {
    Icon: InformationCircleIcon,
    background: "bg-background",
    border: "border-foreground",
    iconColor: "text-foreground",
    text: "text-foreground",
  },
  success: {
    Icon: CheckCircleIcon,
    background: "bg-green-600/20",
    border: "border-success",
    iconColor: "text-success",
    text: "text-foreground",
  },
  warning: {
    Icon: ExclamationTriangleIcon,
    background: "bg-yellow-600/20",
    border: "border-warning",
    iconColor: "text-warning",
    text: "text-foreground",
  },
  error: {
    Icon: ExclamationCircleIcon,
    background: "bg-red-600/20",
    border: "border-error",
    iconColor: "text-error",
    text: "text-foreground",
  },
};

const alertSizes = {
  sm: "px-3 py-1.5 rounded-md border",
  lg: "px-4 py-3 rounded-md border",
};

const iconSizes = {
  sm: "h-4 w-4 mt-1",
  lg: "h-5 w-5 mt-0.5",
};

const spacingSizes = {
  sm: "ml-2",
  lg: "ml-3",
};

function Alert({ type = "info", size = "lg", ...props }: AlertProps) {
  const { Icon, background, border, text, iconColor } = ALERT_CONFIGS[type];

  return (
    <div
      className={cn(
        `flex flex-row items-start ${background} border-[0.5px] border-solid ${border} shadow-sm ${alertSizes[size]}`,
        props.className,
      )}
    >
      <Icon className={`flex-shrink-0 ${iconColor} ${iconSizes[size]}`} />
      <div className="flex flex-1 flex-col">
        <div className={`${spacingSizes[size]} ${text}`}>{props.children}</div>
      </div>
    </div>
  );
}

export default Alert;

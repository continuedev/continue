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
    background: "bg-blue-600/20",
    border: "border-blue-500",
    iconColor: "text-blue-500",
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
  sm: "px-3 py-2 rounded-md",
  lg: "px-3 py-2.5 rounded-md",
};

const iconSizes = {
  sm: "h-4 w-4",
  lg: "h-4 w-4",
};

const spacingSizes = {
  sm: "ml-2",
  lg: "ml-2",
};

function Alert({
  type = "info",
  size = "lg",
  className,
  children,
  ...props
}: AlertProps) {
  const { Icon, background, border, text, iconColor } = ALERT_CONFIGS[type];

  return (
    <div
      className={cn(
        `flex flex-row items-start ${background} border-[0.5px] ${border} border-solid shadow-sm ${alertSizes[size]}`,
        className,
      )}
      {...props}
    >
      <Icon className={`flex-shrink-0 ${iconColor} ${iconSizes[size]}`} />
      <div className="flex flex-1 flex-col">
        <div className={`${spacingSizes[size]} ${text}`}>{children}</div>
      </div>
    </div>
  );
}

export default Alert;

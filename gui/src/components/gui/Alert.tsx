import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import { varWithFallback } from "../../styles/theme";
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
    border: string;
    text: string;
  };
};

const ALERT_CONFIGS: AlertConfig = {
  info: {
    Icon: InformationCircleIcon,
    border: "border-info",
    iconColor: "text-info",
    text: "text-foreground",
  },
  success: {
    Icon: CheckCircleIcon,
    border: "border-success",
    iconColor: "text-success",
    text: "text-foreground",
  },
  warning: {
    Icon: ExclamationTriangleIcon,
    border: "border-warning",
    iconColor: "text-warning",
    text: "text-foreground",
  },
  error: {
    Icon: ExclamationCircleIcon,
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
  const { Icon, border, text, iconColor } = ALERT_CONFIGS[type];

  const colorMap = {
    info: varWithFallback("info"),
    success: varWithFallback("success"),
    warning: varWithFallback("warning"),
    error: varWithFallback("error"),
  };

  return (
    <div
      className={cn(
        `flex flex-row items-start border-[0.5px] ${border} border-solid shadow-sm ${alertSizes[size]}`,
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${colorMap[type]} 20%, transparent)`,
      }}
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

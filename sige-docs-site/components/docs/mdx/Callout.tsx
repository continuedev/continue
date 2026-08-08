import { Info, Lightbulb, AlertTriangle, FileText } from "lucide-react";

const variants = {
  info: {
    icon: Info,
    borderColor: "border-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    iconColor: "text-blue-500",
  },
  tip: {
    icon: Lightbulb,
    borderColor: "border-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    iconColor: "text-green-500",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    iconColor: "text-amber-500",
  },
  note: {
    icon: FileText,
    borderColor: "border-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    iconColor: "text-gray-500",
  },
};

export function Callout({
  variant = "info",
  children,
}: {
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  const config = variants[variant] || variants.info;
  const Icon = config.icon;

  return (
    <div
      className={`my-4 flex gap-3 border-l-4 ${config.borderColor} ${config.bgColor} rounded-r-md p-4`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${config.iconColor}`} />
      <div className="flex-1 text-sm [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}

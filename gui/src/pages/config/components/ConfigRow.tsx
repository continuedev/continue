import React from "react";

export interface ConfigRowProps {
  title: string;
  description: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function ConfigRow({
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  children,
  className = "",
}: ConfigRowProps) {
  const baseClasses = `flex items-start justify-between rounded-md transition-colors ${className}`;
  const interactiveClasses = onClick
    ? "hover:bg-vsc-editor-background/50 cursor-pointer"
    : "";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${disabledClasses}`.trim()}
      onClick={handleClick}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {Icon && <Icon className="h-5 w-5 flex-shrink-0 text-gray-400" />}
      </div>
    </div>
  );
}
import React from "react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../util/cn";

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
  const baseClasses =
    "flex items-start justify-between gap-4 px-4 py-4 text-left transition-colors";
  const interactiveClasses = onClick
    ? "hover:bg-vsc-input-background/60 cursor-pointer"
    : "";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  const handleClick = (event: React.MouseEvent) => {
    if (!disabled && onClick) {
      const target = event.target as HTMLElement;
      const isInteractiveChild = target.closest(
        'button, input, textarea, select, [role="button"], [role="switch"]',
      );

      if (
        !isInteractiveChild ||
        target.closest("[data-config-row]") === event.currentTarget
      ) {
        onClick();
      }
    }
  };

  if (onClick) {
    return (
      <Button
        variant="ghost"
        className={cn(
          baseClasses,
          interactiveClasses,
          disabledClasses,
          "!my-0 text-left",
          className,
        )}
        onClick={handleClick}
        disabled={disabled}
        data-config-row
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-5">{title}</span>
          <p className="text-description-muted mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {children}
          {Icon && (
            <Icon className="text-description-muted h-4 w-4 flex-shrink-0" />
          )}
        </div>
      </Button>
    );
  }

  return (
    <div
      className={cn(baseClasses, disabledClasses, className)}
      data-config-row
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium leading-5">{title}</span>
        <p className="text-description-muted mt-1 text-xs leading-5">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {children}
        {Icon && (
          <Icon className="text-description-muted h-4 w-4 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

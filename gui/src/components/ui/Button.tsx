import * as React from "react";
import { cn } from "../../util/cn";

type ButtonVariant = "ghost" | "primary" | "secondary" | "outline" | "icon";
type ButtonSize = "sm" | "lg";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const buttonVariants = {
  primary:
    "border-none text-primary-foreground bg-primary hover:enabled:bg-primary-hover active:enabled:brightness-95 shadow-sm",
  secondary:
    "border border-solid border-border text-foreground bg-secondary hover:enabled:bg-secondary-hover active:enabled:brightness-95",
  outline:
    "border border-solid border-border text-foreground bg-transparent hover:enabled:bg-secondary hover:enabled:border-description-muted",
  ghost:
    "border-none text-description bg-transparent hover:enabled:text-foreground hover:enabled:bg-list-hover",
  icon: "border border-solid border-border text-description bg-transparent hover:enabled:text-foreground hover:enabled:bg-list-hover hover:enabled:border-description-muted rounded-full p-0 flex items-center justify-center",
};

const buttonSizes = {
  sm: "px-2 py-1 text-2xs",
  lg: "px-3 py-1.5 text-sm",
};

const iconButtonSizes = {
  sm: "h-4 w-4",
  lg: "h-5 w-5",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "lg", className, ...props }, ref) => {
    const isIcon = variant === "icon";
    return (
      <button
        ref={ref}
        className={cn(
          "ease-ruckus cursor-pointer font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150",
          "hover:enabled:cursor-pointer",
          // Keyboard focus is a violet ring rather than the browser default
          "focus-visible:ring-accent outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonVariants[variant],
          isIcon
            ? iconButtonSizes[size]
            : `my-1.5 rounded-default ${buttonSizes[size]}`,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };

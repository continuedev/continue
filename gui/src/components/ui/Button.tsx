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
    "border-none text-primary-foreground bg-primary hover:enabled:brightness-125",
  secondary:
    "border-none text-foreground bg-border hover:enabled:brightness-125",
  outline:
    "border border-solid border-description text-foreground bg-transparent hover:enabled:bg-input",
  ghost:
    "border-none text-foreground bg-inherit hover:enabled:brightness-125 hover:enabled:bg-input",
  icon: "border border-solid border-description text-description bg-transparent hover:enabled:text-foreground hover:enabled:bg-input hover:enabled:border-description rounded-full p-0 flex items-center justify-center",
};

const buttonSizes = {
  sm: "px-1.5 py-0.5 text-2xs",
  lg: "px-2 py-1 text-sm",
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
          "cursor-pointer transition-all duration-200",
          "hover:enabled:cursor-pointer",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonVariants[variant],
          isIcon
            ? iconButtonSizes[size]
            : `my-1.5 rounded ${buttonSizes[size]}`,
          className,
        )}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          ...props.style,
        }}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };

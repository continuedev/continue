import * as React from "react";
import { cn } from "../../util/cn";

type ButtonVariant = "ghost" | "primary" | "secondary" | "outline";
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
    "border border-solid border-badge border-border text-foreground bg-transparent hover:enabled:bg-input",
  ghost:
    "border-none text-foreground bg-inherit hover:enabled:brightness-125 hover:enabled:bg-input",
};

const buttonSizes = {
  sm: "px-1.5 py-0.5 text-2xs",
  lg: "px-2 py-1 text-sm",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "lg", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "my-1.5 cursor-pointer rounded transition-all duration-200",
          "hover:enabled:cursor-pointer",
          "disabled:text-description-muted disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant],
          buttonSizes[size],
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

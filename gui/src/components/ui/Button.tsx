import * as React from "react";
import { cn } from "../../util/cn";
import { FontSizeModifier, useFontSize } from "./font";

type ButtonVariant = "ghost" | "primary" | "secondary" | "outline";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  fontSizeModifier?: FontSizeModifier;
};

const buttonVariants = {
  primary:
    "px-3 py-1.5 border-none text-background bg-foreground hover:enabled:brightness-125",
  secondary:
    "px-3 py-1.5 border border-input-border text-foreground bg-input hover:enabled:bg-background hover:enabled:opacity-90",
  outline:
    "px-3 py-1.5 border-[0.5px] border-foreground text-foreground bg-transparent hover:enabled:bg-foreground/10",
  ghost:
    "px-2 py-1.5 border-none text-foreground bg-gray-500/40 hover:enabled:brightness-125",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", fontSizeModifier = 0, className, ...props }, ref) => {
    const fontSize = useFontSize(fontSizeModifier);

    return (
      <button
        ref={ref}
        className={cn(
          "my-1.5 cursor-pointer rounded transition-all duration-200",
          "hover:enabled:cursor-pointer",
          "disabled:text-description-muted disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant],
          className,
        )}
        style={{
          fontSize,
          ...props.style,
        }}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };

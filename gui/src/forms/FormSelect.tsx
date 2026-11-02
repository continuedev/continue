import { forwardRef } from "react";
import {
  vscCommandCenterInactiveBorder,
  vscForeground,
  vscInputBackground,
} from "../components";
import { cn } from "../util/cn";

/** Native <select> that forwards its ref so it works with react-hook-form's register(). */
export const FormSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function FormSelect({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={cn("rounded-default w-full border px-3 py-1.5", className)}
      style={{
        borderColor: vscCommandCenterInactiveBorder,
        backgroundColor: vscInputBackground,
        color: vscForeground,
      }}
    >
      {children}
    </select>
  );
});

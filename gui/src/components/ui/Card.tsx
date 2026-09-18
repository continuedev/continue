import { cn } from "../../util/cn";

interface CardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "bg-editor border-border rounded-card shadow-sm space-y-0 border border-solid px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

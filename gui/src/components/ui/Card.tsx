import { cn } from "../../util/cn";

interface CardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn("space-y-0 rounded-default bg-editor px-4 py-3", className)}
    >
      {children}
    </div>
  );
}

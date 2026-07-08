interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <div
      className={`border-command-border my-2 border-[0.5px] border-b border-solid opacity-20 ${className || ""}`}
    />
  );
}

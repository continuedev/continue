interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <div
      className={`my-2 border-[0.5px] border-b border-solid border-command-border opacity-20 ${className || ""}`}
    />
  );
}

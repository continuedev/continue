interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-vsc-editor-background space-y-0 rounded-lg p-4 ${className}`}
    >
      {children}
    </div>
  );
}

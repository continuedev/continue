interface CardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-editor rounded-default space-y-0 px-4 py-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-1">
      <span className="text-sm text-description">{message}</span>
    </div>
  );
}

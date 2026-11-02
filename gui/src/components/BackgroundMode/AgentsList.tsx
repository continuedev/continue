interface AgentsListProps {
  isCreatingAgent?: boolean;
}

export function AgentsList({ isCreatingAgent = false }: AgentsListProps) {
  return (
    <div className="px-2 py-4 text-center text-sm text-description-muted">
      Background agents are not available.
    </div>
  );
}

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { AgentsList } from "./AgentsList";

interface BackgroundModeViewProps {
  isCreatingAgent?: boolean;
}

export function BackgroundModeView({
  isCreatingAgent = false,
}: BackgroundModeViewProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="px-2">
        <div className="text-sm text-description">
          Submit a task above to run a background agent. Your task will appear
          below in ~30 seconds once the container starts.
        </div>
        {isCreatingAgent && (
          <div className="mt-2 flex items-center gap-2 text-xs text-description-muted">
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            <span>Creating task...</span>
          </div>
        )}
      </div>
      <AgentsList isCreatingAgent={isCreatingAgent} />
    </div>
  );
}

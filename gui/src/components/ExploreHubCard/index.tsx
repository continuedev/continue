import { Button } from "..";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setIsExploreDialogOpen } from "../../redux/slices/uiSlice";
import { ReusableCard } from "../ReusableCard";

export function ExploreHubCard() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.isExploreDialogOpen);

  if (!isOpen) return null;

  return (
    <ReusableCard
      showCloseButton={true}
      onClose={() => dispatch(setIsExploreDialogOpen(false))}
    >
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <h2 className="text-2xl font-semibold">
          Discover Custom AI Assistants
        </h2>

        <p className="max-w-lg text-base leading-relaxed">
          Explore specialized AI assistants designed to enhance your development
          workflow. Find the perfect assistant for code review, documentation,
          and more.
        </p>

        <Button
        // href="https://hub.continue.dev/explore/trending-assistants"
        // target="_blank"
        // rel="noopener noreferrer"
        >
          Explore Assistants Hub
        </Button>
      </div>
    </ReusableCard>
  );
}

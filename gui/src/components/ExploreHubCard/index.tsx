import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { Button, ButtonSubtext } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setIsExploreDialogOpen } from "../../redux/slices/uiSlice";
import { setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";

export function ExploreHubCard() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.isExploreDialogOpen);
  const ideMessenger = useContext(IdeMessengerContext);

  if (!isOpen) return null;

  return (
    <ReusableCard
      showCloseButton={true}
      onClose={() => {
        setLocalStorage("isExploreDialogOpen", false);
        return dispatch(setIsExploreDialogOpen(false));
      }}
    >
      <div className="flex flex-col items-center gap-1 p-4 text-center">
        <h2 className="text-2xl font-semibold">Create Your Own Assistant</h2>

        <p className="max-w-lg text-base leading-relaxed">
          Discover and remix popular assistants, or create your own from scratch
        </p>

        <Button
          className="w-full"
          onClick={() => {
            ideMessenger.request("controlPlane/openUrl", {
              path: "/explore/assistants",
              orgSlug: undefined,
            });
          }}
        >
          Explore Assistants
        </Button>

        <ButtonSubtext
          onClick={() => {
            ideMessenger.request("controlPlane/openUrl", {
              path: "/new?type=assistant",
              orgSlug: undefined,
            });
          }}
        >
          <div className="mt-4 flex cursor-pointer items-center justify-center gap-1">
            <span>Or, create your own assistant from scratch</span>
            <ChevronRightIcon className="h-3 w-3" />
          </div>
        </ButtonSubtext>
      </div>
    </ReusableCard>
  );
}

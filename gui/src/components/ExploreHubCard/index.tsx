import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { Button, ButtonSubtext } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setIsExploreDialogOpen } from "../../redux/slices/uiSlice";
import { LocalStorageKey, setLocalStorage } from "../../util/localStorage";
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
        setLocalStorage(LocalStorageKey.IsExploreDialogOpen, false);
        setLocalStorage(LocalStorageKey.HasDismissedExploreDialog, true);
        return dispatch(setIsExploreDialogOpen(false));
      }}
    >
      <div className="flex flex-col items-center gap-1 px-4 text-center">
        <div className="mb-4">
          <h2 className="mb-1 text-xl font-semibold">
            Create Your Own Assistant
          </h2>

          <p className="text-lightgray my-0 max-w-lg text-sm font-light leading-relaxed">
            Discover and remix popular assistants, or create your own from
            scratch
          </p>
        </div>

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
          <div className="flex cursor-pointer items-center justify-center gap-1">
            <span>Or, create your own assistant from scratch</span>
            <ChevronRightIcon className="h-3 w-3" />
          </div>
        </ButtonSubtext>
      </div>
    </ReusableCard>
  );
}

import { PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../util";
import AddDocsDialog from "../../../dialogs/AddDocsDialog";

export function AddBlockButton(props: { blockType: string }) {
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  const handleClick = () => {
    if (selectedProfile?.profileType === "local") {
      switch (props.blockType) {
        case "docs":
          dispatch(setShowDialog(true));
          dispatch(setDialogMessage(<AddDocsDialog />));
          break;
        default:
          ideMessenger.request("config/openProfile", {
            profileId: selectedProfile.id,
          });
      }
    } else {
      ideMessenger.request("controlPlane/openUrl", {
        path: `new?type=block&blockType=${props.blockType}`,
        orgSlug: undefined,
      });
    }
  };

  return (
    <div
      className="cursor-pointer rounded px-2 pb-1 text-center text-gray-400 hover:text-gray-300"
      style={{
        fontSize: fontSize(-3),
      }}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <PlusIcon className="h-3 w-3" /> Add
      </div>
    </div>
  );
}

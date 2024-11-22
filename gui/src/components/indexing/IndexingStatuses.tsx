import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import IndexingStatusViewer from "./IndexingStatus";
import { Button, SecondaryButton } from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import AddDocsDialog from "../dialogs/AddDocsDialog";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "../gui/Tooltip";

function IndexingStatuses() {
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexing.statuses,
  );
  const docsStatuses = useMemo(() => {
    const docs = Object.values(indexingStatuses).filter(
      (status) => status.type === "docs" && status.status !== "deleted",
    );
    return docs;
  }, [indexingStatuses]);
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center justify-between">
        <h3 className="mb-1 mt-0 text-xl">@docs indexes</h3>
        {docsStatuses.length ? (
          <div
            className="border-vsc-foreground text-vsc-foreground enabled:hover:bg-vsc-background m-2 rounded border border-solid bg-inherit px-3 py-2 enabled:hover:cursor-pointer enabled:hover:opacity-90 disabled:text-gray-500"
            onClick={() => {
              dispatch(setShowDialog(true));
              dispatch(setDialogMessage(<AddDocsDialog />));
            }}
          >
            Add
          </div>
        ) : // <div>
        //   <PlusCircleIcon
        //     data-tooltip-id={"more-add-docs-button"}
        //     className="text-vsc-foreground-muted h-5 w-5 cursor-pointer focus:ring-0"
        //     onClick={() => {
        //       dispatch(setShowDialog(true));
        //       dispatch(setDialogMessage(<AddDocsDialog />));
        //     }}
        //   />
        //   <ToolTip id={"more-add-docs-button"} place="top">
        //     Add Docs
        //   </ToolTip>
        // </div>
        null}
      </div>
      <span className="text-xs text-stone-500">
        Manage your documentation sources
      </span>
      <div className="flex max-h-[170px] flex-col gap-1 overflow-x-hidden overflow-y-scroll pr-2">
        {docsStatuses.length ? (
          docsStatuses.map((status) => {
            return <IndexingStatusViewer key={status.id} status={status} />;
          })
        ) : (
          <SecondaryButton>Add Docs</SecondaryButton>
        )}
      </div>
    </div>
  );
}

export default IndexingStatuses;

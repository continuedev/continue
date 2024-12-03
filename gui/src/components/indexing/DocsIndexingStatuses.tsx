import { useDispatch } from "react-redux";
import { SecondaryButton } from "..";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import AddDocsDialog from "../dialogs/AddDocsDialog";
import DocsIndexingStatus from "./DocsIndexingStatus";
import { useAppSelector } from "../../redux/hooks";

function DocsIndexingStatuses() {
  const dispatch = useDispatch();
  const config = useAppSelector((store) => store.config.config);
  const configDocs = config.docs ?? [];

  // const indexingStatuses = useSelector(
  //   (store: RootState) => store.indexing.indexing.statuses,
  // );
  // const docsStatuses = useMemo(() => {
  //   const docs = Object.values(indexingStatuses).filter(
  //     (status) => status.type === "docs" && status.status !== "deleted",
  //   );
  //   return docs;
  // }, [indexingStatuses]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center justify-between">
        <h3 className="mb-1 mt-0 text-xl">@docs indexes</h3>
        {configDocs.length ? (
          <SecondaryButton
            className="border-vsc-foreground text-vsc-foreground enabled:hover:bg-vsc-background m-2 rounded border bg-inherit px-3 py-2 enabled:hover:cursor-pointer enabled:hover:opacity-90 disabled:text-gray-500"
            type="submit"
            onClick={() => {
              dispatch(setShowDialog(true));
              dispatch(setDialogMessage(<AddDocsDialog />));
            }}
          >
            Add
          </SecondaryButton>
        ) : null}
      </div>
      <span className="text-xs text-stone-500">
        Manage your documentation sources
      </span>
      <div className="flex max-h-[170px] flex-col gap-1 overflow-x-hidden overflow-y-scroll pr-2">
        {configDocs.map((doc) => {
          return <DocsIndexingStatus key={doc.startUrl} docConfig={doc} />;
        })}
      </div>
    </div>
  );
}

export default DocsIndexingStatuses;

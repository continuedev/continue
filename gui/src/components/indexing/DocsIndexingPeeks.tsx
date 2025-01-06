import { useDispatch } from "react-redux";
import { IndexingStatus } from "core";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

export interface DocsIndexingPeekProps {
  status: IndexingStatus;
}

function DocsIndexingPeek({ status }: DocsIndexingPeekProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const progressPercentage = useMemo(() => {
    return Math.min(100, Math.max(0, status.progress * 100));
  }, [status.progress]);

  return (
    <div
      className="text-description hover:bg-hover/10 flex cursor-pointer flex-row items-center gap-2 rounded-md px-1"
      onClick={() => {
        navigate("/more");
        dispatch(setShowDialog(false));
        dispatch(setDialogMessage(undefined));
      }}
    >
      <p className="text-description m-0 p-0 group-hover:underline">
        {status.title}
      </p>
      <div className="border-border my-2 h-1.5 flex-1 rounded-md border border-solid">
        <div
          className={`bg-vsc-editor-background h-full rounded-lg transition-all duration-200 ease-in-out`}
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>
      <div className="xs:flex text-description hidden flex-row items-center gap-1">
        <span className="text-xs no-underline">
          {progressPercentage.toFixed(0)}%
        </span>
        {/* <ArrowPathIcon
          className={`animate-spin-slow inline-block h-4 w-4 text-description`}
        ></ArrowPathIcon> */}
      </div>
    </div>
  );
}

interface DocsIndexingPeeksProps {
  statuses: IndexingStatus[];
}

function DocsIndexingPeekList({ statuses }: DocsIndexingPeeksProps) {
  return (
    <div className="border-vsc-input-border mt-2 flex flex-col border-0 border-t border-solid pt-2">
      <p className="text-description mx-0 my-1.5 p-0 px-1 font-semibold">
        Currently Indexing:
      </p>
      <div className="max-h-[100px] overflow-y-auto pr-2">
        {statuses.length ? (
          statuses.map((status) => {
            return <DocsIndexingPeek key={status.id} status={status} />;
          })
        ) : (
          <p className="text-description m-0 pl-1 font-semibold">None</p>
        )}
      </div>
    </div>
  );
}

export default DocsIndexingPeekList;

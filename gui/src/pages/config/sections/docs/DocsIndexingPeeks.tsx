import { IndexingStatus } from "core";
import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";

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
      className="text-lightgray flex cursor-pointer flex-row items-center gap-2 rounded-md px-1 hover:bg-gray-700/10"
      onClick={() => {
        // navigate("/more"); TODO
        dispatch(setShowDialog(false));
        dispatch(setDialogMessage(undefined));
      }}
    >
      <p className="text-lightgray m-0 p-0 group-hover:underline">
        {status.title}
      </p>
      <div className="my-2 h-1.5 flex-1 rounded-md border border-solid border-gray-400">
        <div
          className={`h-full rounded-lg bg-stone-500 transition-all duration-200 ease-in-out`}
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>
      <div className="xs:flex text-lightgray hidden flex-row items-center gap-1">
        <span className="text-xs no-underline">
          {progressPercentage.toFixed(0)}%
        </span>
        {/* <ArrowPathIcon
          className={`animate-spin-slow inline-block h-4 w-4 text-lightgray`}
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
      <div className="max-h-[100px] overflow-y-auto pr-2">
        {statuses.map((status) => {
          return <DocsIndexingPeek key={status.id} status={status} />;
        })}
      </div>
    </div>
  );
}

export default DocsIndexingPeekList;

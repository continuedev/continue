import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";

import { IndexingStatus } from "core";
import { useContext, useMemo } from "react";
import { STATUS_TO_ICON } from "./utils";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface IndexingStatusViewerProps {
  status: IndexingStatus;
}

function FooterIndexingPeek({ status }: IndexingStatusViewerProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const progressPercentage = useMemo(() => {
    return Math.min(100, Math.max(0, status.progress * 100));
  }, [status.progress]);

  const Icon = STATUS_TO_ICON[status.status];

  return (
    <div className="border-t-1 flex flex-row items-center gap-2 border border-0 border-gray-400 px-2 py-1">
      <div
        className={`flex flex-row items-center gap-2 ${status.url ? "hover:cursor-pointer hover:underline" : ""}`}
        onClick={() => {
          if (status.url) {
            ideMessenger.post("openUrl", status.url);
          }
        }}
      >
        {status.icon ? (
          <img src={status.icon} alt="doc icon" className="h-4 w-4" />
        ) : null}
        <p className="lines lines-1 m-0 p-0 text-left">
          {status.title ?? status.id}
        </p>
      </div>
      <div className="my-2 h-1.5 w-full rounded-md border border-solid border-gray-400">
        <div
          className={`h-full rounded-lg bg-stone-500 transition-all duration-200 ease-in-out`}
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>
      <div className="flex flex-row items-center gap-1 text-stone-500">
        <span className="text-xs">{progressPercentage.toFixed(0)}%</span>
        {Icon ? (
          <Icon
            className={`inline-block h-4 w-4 text-stone-500 ${
              status.status === "indexing" ? "animate-spin-slow" : ""
            }`}
          ></Icon>
        ) : null}
      </div>
    </div>
  );
}

function FooterIndexingPeeks() {
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexingStatuses,
  );
  const currentlyIndexingDocs = useMemo(() => {
    return Object.values(indexingStatuses).filter(
      (status) => status.status === "indexing",
    );
  }, [indexingStatuses]);

  return (
    <>
      {currentlyIndexingDocs.map((status) => {
        return <FooterIndexingPeek status={status} />;
      })}
    </>
  );
}

export default FooterIndexingPeeks;

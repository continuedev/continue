import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";

import { IndexingStatus } from "core";
import { useContext, useMemo, useState } from "react";
import { STATUS_TO_ICON } from "./utils";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { current } from "@reduxjs/toolkit";

interface IndexingStatusViewerProps {
  status: IndexingStatus;
}

function ChatIndexingPeek({ status }: IndexingStatusViewerProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();

  const progressPercentage = useMemo(() => {
    return Math.min(100, Math.max(0, status.progress * 100));
  }, [status.progress]);

  const Icon = STATUS_TO_ICON[status.status];

  return (
    <div
      className="flex cursor-pointer flex-row items-center gap-2 hover:opacity-80"
      onClick={() => {
        navigate("/more");
      }}
    >
      <div
        className={`flex flex-row items-center gap-2 ${status.url ? "hover:cursor-pointer hover:underline" : ""}`}
        onClick={(e) => {
          if (status.url) {
            ideMessenger.post("openUrl", status.url);
            e.stopPropagation();
          }
        }}
      >
        {status.icon ? (
          <img
            src={status.icon}
            alt="icon"
            className="2xs:block hidden h-4 w-4"
          />
        ) : null}
        <p className="lines lines-1 m-0 max-w-20 p-0 text-left">
          {status.title ?? status.id}
        </p>
      </div>
      <div className="my-2 h-1.5 flex-1 rounded-md border border-solid border-gray-400">
        <div
          className={`h-full rounded-lg bg-stone-500 transition-all duration-200 ease-in-out`}
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>
      <div className="xs:flex hidden flex-row items-center gap-1 text-stone-500">
        <span className="text-xs">{progressPercentage.toFixed(0)}%</span>
        {Icon ? (
          <Icon
            className={`inline-block h-4 w-4 text-stone-500 ${
              status.status === "indexing" ? "animate-spin-slow" : ""
            }`}
          ></Icon>
        ) : null}
      </div>
      {/* <XMarkIcon className="h-4 w-4 text-stone-500" /> */}
    </div>
  );
}

function ChatIndexingPeeks() {
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexingStatuses,
  );
  const [hidden, setHidden] = useState(false);
  const currentlyIndexingDocs = useMemo(() => {
    return Object.values(indexingStatuses).filter(
      (status) => status.status === "indexing",
    );
  }, [indexingStatuses]);

  if (!currentlyIndexingDocs.length) return null;

  return (
    <div className="flex flex-col gap-1 px-3 pb-1">
      {/* <p className="m-0 p-0 text-xs text-stone-500">Indexing in progress</p> */}
      {hidden
        ? null
        : currentlyIndexingDocs.map((status) => {
            return <ChatIndexingPeek status={status} />;
          })}
    </div>
  );
}

export default ChatIndexingPeeks;

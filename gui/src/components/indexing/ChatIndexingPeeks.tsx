import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";

import { IndexingStatus } from "core";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowPathIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { setIndexingChatPeekHidden } from "../../redux/slices/stateSlice";

interface MergedIndexingState {
  displayName: string;
  type: IndexingStatus["type"];
  titles: IndexingStatus["title"][];
  progressPercentage: number;
}

const mergeProgress = (states: IndexingStatus[]): number => {
  const progress =
    states.reduce((acc, state) => acc + state.progress, 0) / states.length;
  return Math.min(100, Math.max(0, progress * 100));
};

export interface ChatIndexingPeekProps {
  state: MergedIndexingState;
}

function ChatIndexingPeek({ state }: ChatIndexingPeekProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const hiddenPeeks = useSelector(
    (store: RootState) => store.state.indexing.hiddenChatPeekTypes,
  );

  if (hiddenPeeks[state.type]) return null;
  return (
    <div
      className="flex flex-row items-center border-0 border-t border-solid border-t-zinc-700 px-3 py-0.5"
      onClick={() => {
        navigate("/more");
      }}
    >
      <div className="group flex flex-1 cursor-pointer flex-row items-center gap-2">
        <div className={`flex flex-row items-center gap-2`}>
          <p className="m-0 p-0 text-stone-500 group-hover:underline">
            {state.displayName}
          </p>
        </div>
        <div className="my-2 h-1.5 flex-1 rounded-md border border-solid border-gray-400">
          <div
            className={`h-full rounded-lg bg-stone-500 transition-all duration-200 ease-in-out`}
            style={{
              width: `${state.progressPercentage}%`,
            }}
          />
        </div>
        <div className="xs:flex hidden flex-row items-center gap-1 text-stone-500">
          <span className="text-xs no-underline">
            {state.progressPercentage.toFixed(0)}%
          </span>
          <ArrowPathIcon
            className={`animate-spin-slow inline-block h-4 w-4 text-stone-500`}
          ></ArrowPathIcon>
        </div>
      </div>
      <EyeSlashIcon
        className="ml-2 h-4 w-4 cursor-pointer text-stone-500 hover:opacity-80"
        onClick={(e) => {
          dispatch(
            setIndexingChatPeekHidden({ type: state.type, hidden: true }),
          );
          e.stopPropagation();
        }}
      />
    </div>
  );
}

function ChatIndexingPeeks() {
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexing.statuses,
  );
  const mergedIndexingStates: MergedIndexingState[] = useMemo(() => {
    const mergedStates: MergedIndexingState[] = [];

    const docsStates = Object.values(indexingStatuses).filter(
      (status) => status.type === "docs" && status.status === "indexing",
    );
    if (docsStates.length > 0) {
      mergedStates.push({
        displayName: "Docs indexing",
        type: "docs",
        titles: docsStates.map((state) => state.title),
        progressPercentage: mergeProgress(docsStates),
      });
    }
    return mergedStates;
  }, [indexingStatuses]);

  if (!mergedIndexingStates.length) return null;

  return (
    <div className="flex flex-col gap-1">
      {mergedIndexingStates.map((state) => {
        return <ChatIndexingPeek key={state.type} state={state} />;
      })}
    </div>
  );
}

export default ChatIndexingPeeks;

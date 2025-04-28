import React from "react";

export const ProgressBlock: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="flex items-center justify-end opacity-80">
      <span className="inline-block w-[55px] text-right tabular-nums">
        {Math.floor(progress)}%
      </span>
      <span className="ml-1">complete</span>
    </div>
  );
};

import { memo } from "react";
import { LLMResult } from "../../hooks/useLLMLog";
import Result from "./Result";

interface ResultGroupProps {
  group: LLMResult[];
}

const ResultGroup = memo(function ResultGroup({ group }: ResultGroupProps) {
  return (
    <>
      {group.map((result, i) => (
        <Result
          key={`${result.timestamp}-${i}`}
          result={result}
          prevResult={group[i - 1]}
        ></Result>
      ))}
    </>
  );
});

export default ResultGroup;

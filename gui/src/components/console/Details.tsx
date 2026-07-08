import { useEffect, useRef, useState } from "react";
import { LLMInteraction } from "../../hooks/useLLMLog";
import useLLMSummary from "../../hooks/useLLMSummary";
import End from "./End";
import ResultGroup from "./ResultGroup";
import Start from "./Start";
import StatusIcon from "./StatusIcon";

export interface DetailsProps {
  interaction: LLMInteraction;
}

function renderCell(children: React.ReactNode) {
  return (
    <div className="border-0 border-r-2 border-solid border-[color:var(--vscode-panel-border)] pl-2 pr-2 text-sm">
      {children}
    </div>
  );
}

/**
 * A cell of statistics at the top of the details view
 */
function Cell({
  label,
  value,
  format,
}: {
  label: string;
  value: any;
  format?: (value: any) => string;
}) {
  return renderCell(
    value != undefined ? `${label}: ${format ? format(value) : value}` : "",
  );
}

/**
 * A cell of statistics at the top of the details view with custom content
 */
function CustomCell({ children }: { children: React.ReactNode }) {
  return renderCell(children);
}

function formatSeconds(milliseconds: number) {
  return (milliseconds / 1000).toFixed(2) + "s";
}

export default function Details({ interaction }: DetailsProps) {
  const scrollTop = useRef<HTMLDivElement>(null);
  const lastResult = useRef<any>(null);
  const summary = useLLMSummary(interaction);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Handler to check if user is at the bottom
  function handleScroll() {
    const elt = scrollTop.current;
    if (!elt) {
      return;
    }
    // Allow a small threshold for floating point errors
    const threshold = 5;
    setIsAtBottom(
      elt.scrollHeight - elt.scrollTop - elt.clientHeight < threshold,
    );
  }

  useEffect(() => {
    if (interaction.end) {
      return;
    }

    const last = interaction.results[interaction.results.length - 1];
    if (last != lastResult.current) {
      lastResult.current = last;
      if (isAtBottom) {
        const lastChild = scrollTop.current?.lastChild;
        if (lastChild) {
          (lastChild as HTMLElement).scrollIntoView({
            behavior: "auto",
            block: "end",
          });
        }
      }
    }
  }, [interaction, isAtBottom]);

  return (
    <div className="m-0 flex min-w-0 flex-1 shrink grow flex-col">
      <div className="shrink-0 text-base">
        <div className="columns-3 gap-0 border-0 border-b-2 border-solid border-[color:var(--vscode-panel-border)] p-0">
          <Cell label="Type" value={summary.type}></Cell>
          <CustomCell>
            Result: <StatusIcon interaction={interaction}></StatusIcon>
            {summary.result}
          </CustomCell>
        </div>
        <div className="columns-3 gap-0 border-0 border-b-2 border-solid border-[color:var(--vscode-panel-border)] p-0">
          <Cell label="Prompt Tokens" value={summary.promptTokens}></Cell>
          <Cell label="Generated Tokens" value={summary.generatedTokens}></Cell>
          <Cell label="ThinkingTokens" value={summary.thinkingTokens}></Cell>
        </div>
        <div className="columns-3 gap-0 border-0 border-b-2 border-solid border-[color:var(--vscode-panel-border)] p-0">
          <Cell
            label="Total Time"
            value={summary.totalTime}
            format={formatSeconds}
          ></Cell>
          <Cell
            label="To First Token"
            value={summary.toFirstToken}
            format={formatSeconds}
          ></Cell>
          <Cell
            label="Tokens/s"
            value={summary.tokensPerSecond}
            format={(v: number) => v.toFixed(1)}
          ></Cell>
        </div>
        {/* {summary.costBreakdown && (
          <pre className="whitespace-pre-wrap px-2 text-sm">
            {summary.costBreakdown.breakdown}
          </pre>
        )} */}
      </div>
      <div
        ref={scrollTop}
        className="grow overflow-auto"
        onScroll={handleScroll}
      >
        {interaction.start ? <Start item={interaction.start}></Start> : ""}
        <div className="whitespace-pre-wrap p-2">
          {interaction.results.map((group, i) => {
            return <ResultGroup key={i} group={group}></ResultGroup>;
          })}
        </div>
        {interaction.end ? <End item={interaction.end}></End> : ""}
      </div>
    </div>
  );
}

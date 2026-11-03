import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import {
  ChecklistGroups,
  ChecklistRow,
  filterRows,
} from "./providerSetupUtils";

interface ModelChecklistProps {
  groups: ChecklistGroups;
  checked: Set<string>;
  onToggle: (model: string) => void;
  /** The lists come from the provider's live model list. */
  isLive?: boolean;
}

function Row({
  row,
  checked,
  onToggle,
}: {
  row: ChecklistRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-input"
      data-testid={`model-row-${row.model}`}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={onToggle}
        aria-label={row.title}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          {row.title}
          {row.configured && (
            <span className="ml-1.5 text-description-muted">(in config)</span>
          )}
          {row.deprecated && (
            <span className="ml-1.5 text-description-muted">(legacy)</span>
          )}
        </span>
        {row.description && (
          <span className="truncate text-description-muted">
            {row.description}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * Checkboxes for the models of one provider, with a search box. Checked models
 * are the ones that end up in config.yaml.
 */
export function ModelChecklist({
  groups,
  checked,
  onToggle,
  isLive,
}: ModelChecklistProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => ({
      configuredOnly: filterRows(groups.configuredOnly, query),
      top: filterRows(groups.top, query),
      other: filterRows(groups.other, query),
    }),
    [groups, query],
  );
  const empty =
    visible.configuredOnly.length +
      visible.top.length +
      visible.other.length ===
    0;

  const section = (label: string, rows: ChecklistRow[]) =>
    rows.length > 0 && (
      <div className="flex flex-col gap-0.5" key={label}>
        <div className="px-1 text-xs font-medium text-description-muted">
          {label}
        </div>
        {rows.map((row) => (
          <Row
            key={row.model}
            row={row}
            checked={checked.has(row.model)}
            onToggle={() => onToggle(row.model)}
          />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-2" data-testid="model-checklist">
      <div className="flex items-center rounded border border-solid border-border bg-background pl-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-description-muted" />
        <input
          type="text"
          aria-label="Search models"
          placeholder="Search models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border-none bg-transparent px-2 py-1.5 text-xs text-foreground outline-none"
        />
      </div>
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {section(
          "Configured, not offered by the provider",
          visible.configuredOnly,
        )}
        {section(isLive ? "Latest available" : "Popular", visible.top)}
        {section(
          isLive ? "Other available models" : "Additional models",
          visible.other,
        )}
        {empty && (
          <div className="px-1 text-xs text-description-muted">
            No model matches "{query}".
          </div>
        )}
      </div>
      <div className="text-xs text-description-muted">
        {checked.size} model{checked.size === 1 ? "" : "s"} selected
      </div>
    </div>
  );
}

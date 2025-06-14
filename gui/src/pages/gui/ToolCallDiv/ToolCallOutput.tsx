import { ContextItemWithId } from "core";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";

export function OutputItems({
  outputItems,
  isShowing,
}: {
  outputItems: ContextItemWithId[];
  isShowing: boolean;
}) {
  if (outputItems.length === 0) return null;
  if (!isShowing) return null;

  return (
    <div
      className="ml-5 mr-2 mt-1 flex flex-col text-xs"
      data-testid="tool-call-output"
    >
      <div className="bg-border my-1 h-[1px]" />
      <span className="text-lightgray font-extrabold">output:</span>
      {outputItems?.map((outputItem) => (
        <div
          key={outputItem.name}
          className="flex flex-row items-center gap-2 py-0.5"
        >
          <ContextItemsPeekItem contextItem={outputItem} />
        </div>
      ))}
    </div>
  );
}

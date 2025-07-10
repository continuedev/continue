import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks/cancelStream";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";

export function StreamingToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();

  return (
    <div className="flex w-full items-center justify-between">
      <GeneratingIndicator />
      <div
        className="text-description text-2xs cursor-pointer p-0.5 pr-1 hover:brightness-125"
        onClick={() => {
          void dispatch(cancelStream());
        }}
      >
        {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
      </div>
    </div>
  );
}

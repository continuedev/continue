import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks/cancelStream";
import { CancelButton } from "./CancelButton";
import { GeneratingIndicator } from "./GeneratingIndicator";

export function StreamingToolbar() {
  const dispatch = useAppDispatch();

  return (
    <div className="flex w-full items-center justify-between">
      <GeneratingIndicator />
      <CancelButton onClick={() => void dispatch(cancelStream())} />
    </div>
  );
}

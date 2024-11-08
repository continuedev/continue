import { CheckIcon, XMarkIcon, PlayIcon } from "@heroicons/react/24/outline";
import Spinner from "./Spinner";
import { vscForeground } from "../..";

const ApplyButton = ({
  applyState,
  onClickApply,
  onClickAccept,
  onClickReject,
}) => {
  switch (applyState) {
    case "closed":
      return (
        <button
          className={`flex items-center border-none bg-transparent text-sm text-[${vscForeground}] outline-none hover:brightness-125`}
          onClick={onClickApply}
        >
          <div className="flex items-center gap-1">
            <PlayIcon className="h-3 w-3" />
            <span className="xs:inline hidden">Apply</span>
          </div>
        </button>
      );
    case "done":
      return (
        <>
          <button
            className={`text-[${vscForeground}] flex items-center border-none bg-transparent text-sm outline-none hover:brightness-125`}
            onClick={onClickReject}
          >
            <XMarkIcon className="mr-1 h-4 w-4 text-red-500 hover:brightness-125" />
            <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
              <span>Reject</span>
            </div>
          </button>
          <button
            className={`text-[${vscForeground}] flex items-center border-none bg-transparent text-sm outline-none hover:brightness-125`}
            onClick={onClickAccept}
          >
            <CheckIcon className="mr-1 h-4 w-4 text-green-500 hover:brightness-125" />
            <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
              <span>Accept</span>
            </div>
          </button>
        </>
      );
    default:
      return <Spinner />;
  }
};

export default ApplyButton;

import type {
  VSCodeBridgeDialogRequest,
  VSCodeBridgeDialogResponse,
} from "core/agent/contracts/index.js";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { Button } from "../ui/Button";

interface VSCodeBridgeDialogProps {
  request: VSCodeBridgeDialogRequest;
  onResolve: (response: VSCodeBridgeDialogResponse) => void;
}

export function VSCodeBridgeDialog({
  request,
  onResolve,
}: VSCodeBridgeDialogProps) {
  const dispatch = useDispatch();

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const resolveWith = (response: VSCodeBridgeDialogResponse) => {
    onResolve(response);
    closeDialog();
  };

  return (
    <div className="p-4 pt-0">
      <h1 className="mb-1 text-center text-xl">{request.title}</h1>
      {request.message ? (
        <p className="text-center text-base" style={{ whiteSpace: "pre-wrap" }}>
          {request.message}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            resolveWith({
              id: request.id,
              confirmed: false,
            });
          }}
        >
          Dismiss
        </Button>
        {(request.options ?? []).map((option) => (
          <Button
            key={option.value}
            variant={option.value === "approve" ? "primary" : "outline"}
            onClick={() => {
              resolveWith({
                id: request.id,
                confirmed: true,
                value: option.value,
              });
            }}
          >
            {option.title}
          </Button>
        ))}
      </div>
    </div>
  );
}

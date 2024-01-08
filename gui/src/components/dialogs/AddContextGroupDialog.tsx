import { ContextItemWithId } from "core";
import { useDispatch } from "react-redux";
import { Button, Input } from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";

function AddContextGroupDialog({
  selectedContextItems,
}: {
  selectedContextItems: ContextItemWithId[];
}) {
  const dispatch = useDispatch();

  let inputElement: HTMLInputElement | null = null;

  const handleCreate = () => {
    dispatch(setDialogMessage(undefined));
    dispatch(setShowDialog(false));
    const title = inputElement ? inputElement.value : "My Context Group";
    // TODO
  };

  return (
    <div className="p-4">
      <Input
        defaultValue="My Context Group"
        type="text"
        ref={(input) => {
          inputElement = input;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleCreate();
          }
        }}
      />
      <br />
      <Button className="ml-auto" onClick={handleCreate}>
        Create
      </Button>
    </div>
  );
}

export default AddContextGroupDialog;

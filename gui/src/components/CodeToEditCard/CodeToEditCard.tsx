import type { CodeToEdit } from "core";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { clearCodeToEdit } from "../../redux/slices/editModeState";
import CodeToEditListItem from "./CodeToEditListItem";

export default function CodeToEditCard() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const codeToEdit = useAppSelector((state) => state.editModeState.codeToEdit);

  function onDelete() {
    dispatch(clearCodeToEdit());
  }

  async function onClickFilename(code: CodeToEdit) {
    if ("range" in code) {
      await ideMessenger.ide.showLines(
        code.filepath,
        code.range.start.line,
        code.range.end.line,
      );
    } else {
      await ideMessenger.ide.openFile(code.filepath);
    }
  }

  return (
    <div className="bg-vsc-editor-background mx-3 flex flex-col rounded-t-lg p-1">
      {codeToEdit.length > 0 ? (
        <ul className="no-scrollbar my-0 mb-1.5 max-h-[50vh] list-outside list-none overflow-y-auto pl-0">
          {codeToEdit.map((code, i) => (
            <CodeToEditListItem
              key={code.filepath + i}
              code={code}
              onDelete={onDelete}
              onClickFilename={onClickFilename}
            />
          ))}
        </ul>
      ) : (
        <div>Highlight code and select Cmd + I to edit a file</div>
      )}
    </div>
  );
}

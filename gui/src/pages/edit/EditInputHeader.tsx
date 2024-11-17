import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getBasename } from "core/util";
import { useContext, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import FileIcon from "../../components/FileIcon";
import HeaderButtonWithToolTip from "../../components/gui/HeaderButtonWithToolTip";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setEditDone, setEditStatus } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";

interface EditInputHeaderParams {}

/**
 * @description This is a class that represents an edit input header.
 */
export function EditInputHeader(editInputHeaderParams: EditInputHeaderParams) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const editModeState = useSelector((state: RootState) => state.editModeState);

  const [showCode, setShowCode] = useState(false);

  function onClick() {
    ideMessenger.ide.showLines(
      editModeState.highlightedCode.filepath,
      editModeState.highlightedCode.range.start.line,
      editModeState.highlightedCode.range.end.line,
    );
    setShowCode(!showCode);
  }

  async function showFullDiff() {
    await ideMessenger.ide.showDiff(
      editModeState.highlightedCode.filepath,
      editModeState.fileAfterEdit,
      0,
    );
    dispatch(setEditStatus({ status: "accepting:full-diff" }));
  }

  return (
    <>
      <div
        className="select-none p-1"
        style={{
          backgroundColor: "#fff2",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex cursor-pointer" onClick={onClick}>
            <FileIcon
              filename={editModeState.highlightedCode.filepath}
              height={"18px"}
              width={"18px"}
            ></FileIcon>
            {getBasename(editModeState.highlightedCode.filepath)} (
            {editModeState.highlightedCode.range.start.line}-
            {editModeState.highlightedCode.range.end.line})
          </div>
          {editModeState.editStatus === "accepting" ||
          editModeState.editStatus === "accepting:full-diff" ? (
            <div className="float-right flex items-center gap-2">
              {/* {editModeState.editStatus === "accepting" ? (
                <>
                  <HeaderButtonWithToolTip text="View full diff">
                    <DocumentPlusIcon
                      className="h-4 w-4 cursor-pointer"
                      onClick={showFullDiff}
                    ></DocumentPlusIcon>
                  </HeaderButtonWithToolTip>
                  <span className="text-xs text-gray-400">
                    N diffs remaining
                  </span>
                </>
              ) : (
                <div>hi</div>
              )} */}

              <div className="flex">
                <HeaderButtonWithToolTip text="Accept">
                  <XMarkIcon
                    className="h-4 w-4 cursor-pointer px-2"
                    color="red"
                    onClick={() => {
                      ideMessenger.post("edit/acceptReject", {
                        accept: false,
                        onlyFirst: false,
                        filepath: editModeState.highlightedCode.filepath,
                      });
                      dispatch(setEditDone());
                    }}
                  ></XMarkIcon>
                </HeaderButtonWithToolTip>
                <HeaderButtonWithToolTip text="Reject">
                  <CheckIcon
                    className="h-4 w-4 cursor-pointer px-2 text-green-500"
                    onClick={() => {
                      ideMessenger.post("edit/acceptReject", {
                        accept: true,
                        onlyFirst: false,
                        filepath: editModeState.highlightedCode.filepath,
                      });
                      dispatch(setEditDone());
                    }}
                  ></CheckIcon>
                </HeaderButtonWithToolTip>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

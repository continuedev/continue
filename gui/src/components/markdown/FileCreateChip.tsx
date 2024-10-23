import { useState, useContext, useEffect } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { VscThemeContext } from "../../context/VscTheme";
import styled from "styled-components";
import {
  vscBackground,
  vscBadgeBackground,
  vscBadgeForeground,
  vscButtonBackground,
  vscEditorBackground,
  vscFocusBorder,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscQuickInputBackground,
  vscSidebarBorder,
} from "..";
import { PlusIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import FileIcon from "../FileIcon";

const FileCreateChip = ({ rawCodeBlock }) => {
  const [filePath, setFilePath] = useState("");
  const [fileExists, setFileExists] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    const lines = rawCodeBlock.trim().split("\n");
    if (lines[0].startsWith("pearCreateFile:")) {
      let path = lines[0].split(":")[1].trim();
      // path = path.replace(/\\/g, "/");
      // let pathSegments = path.split("/");
      // if (pathSegments.length > 1) {
      //   pathSegments.shift();
      // }
      // path = pathSegments.join("/");
      setFilePath(path);
      // checkFileExists();
    } else {
      console.log("Error: createFile: not found in code block");
      setFilePath("");
    }
  }, [rawCodeBlock]);

  // const checkFileExists = async () => {
  //   try {
  //     // this does not work, dont waste your time - promise never resolves
  //     const response = await ideMessenger.ide.fileExists(filePath);
  //     setFileExists(response);
  //   } catch (error) {
  //     console.error(`Error checking file existence: ${error}`);
  //   }
  // };

  const getFileName = (path) => {
    const parts = path.split("/");
    if (path.length === 0) {
      return "";
    }
    return parts[parts.length - 1];
  };

  const handleCreateFile = async () => {
    try {
      await ideMessenger.post("createFile", {
        path: filePath,
      });
      setFileExists(true);
    } catch (error) {
      // TODO: proper error handling, show popup
      console.error(`Error creating file: ${error}`);
    }
  };

  return (
    <div className="mt-2 flex items-center  text-xs font-mono tracking-wide">
      <div
        data-dismissible="chip"
        className="flex justify-center items-center select-none rounded-s-lg border-solid whitespace-nowrap"
        style={{
          backgroundColor: vscInputBackground,
          borderRight: "none",
          borderColor: vscInputBackground,
        }}
        title={filePath}
      >
        <div
          className="flex items-center py-1 px-0 min-[380px]:px-1 rounded-lg"
          style={{
            backgroundColor: vscBackground,
          }}
        >
          <div
            className="hidden min-[380px]:flex"
            style={{
              width: 16,
              height: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileIcon filename={filePath} height={20} width={20} />
          </div>
          <span className="ml-2 mr-5 h-[16px] hidden min-[300px]:inline">
            {filePath}
          </span>
          <span className="ml-2 mr-5 h-[16px] min-[300px]:hidden">
            {getFileName(filePath)}
          </span>
        </div>
      </div>
      <div
        className="flex justify-center items-center py-1 px-0.5 border-solid rounded-e-lg"
        style={{
          borderLeft: "none",
          borderColor: vscInputBackground,
          backgroundColor: vscInputBackground,
        }}
      >
        <span
          className="flex items-center select-none text-center cursor-pointer text-nowrap"
          onClick={handleCreateFile}
        >
          {fileExists ? (
            <span className="flex items-center">
              <span className="mx-1.5 hidden min-[380px]:block">Open File</span>
              <CheckCircleIcon
                className="w-4 h-4"
                strokeWidth={2}
                color="green"
              />
            </span>
          ) : (
            <span className="flex items-center">
              <span className="mx-1.5 hidden min-[380px]:block">Create</span>
              <PlusIcon className="w-4 h-4" strokeWidth={2} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default FileCreateChip;

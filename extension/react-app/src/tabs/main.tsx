import React, { useEffect, useState } from "react";
import { H3, TextArea, Button, Pre, Loader } from "../components";
import styled from "styled-components";
import { postVscMessage, withProgress } from "../vscode";
import { useDebugContextValue } from "../redux/hooks";
import CodeMultiselect from "../components/CodeMultiselect";
import { useSelector } from "react-redux";
import { selectDebugContext } from "../redux/selectors/debugContextSelectors";
import { useDispatch } from "react-redux";
import { updateValue } from "../redux/slices/debugContexSlice";
import { setWorkspacePath } from "../redux/slices/configSlice";
import { SerializedDebugContext } from "../../../src/client";
import { useEditCache } from "../util/editCache";
import { useApi } from "../util/api";

const ButtonDiv = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  margin: 4px;
  flex-wrap: wrap;

  & button {
    flex-grow: 1;
  }
`;

function MainTab(props: any) {
  const dispatch = useDispatch();

  const [suggestion, setSuggestion] = useState("");
  const [traceback, setTraceback] = useDebugContextValue("traceback", "");
  const [selectedRanges, setSelectedRanges] = useDebugContextValue(
    "rangesInFiles",
    []
  );

  const editCache = useEditCache();
  const { debugApi } = useApi();

  const [responseLoading, setResponseLoading] = useState(false);

  let debugContext = useSelector(selectDebugContext);

  useEffect(() => {
    editCache.preloadEdit(debugContext);
  }, [debugContext]);

  function postVscMessageWithDebugContext(
    type: string,
    overrideDebugContext: SerializedDebugContext | null = null
  ) {
    postVscMessage(type, {
      debugContext: overrideDebugContext || debugContext,
    });
  }

  function launchFindSuspiciousCode(newTraceback: string) {
    // setTraceback's effects don't occur immediately, so we have to add it to the debug context manually
    let updatedDebugContext = {
      ...debugContext,
      traceback: newTraceback,
    };
    postVscMessageWithDebugContext("findSuspiciousCode", updatedDebugContext);
    postVscMessageWithDebugContext("preloadEdit", updatedDebugContext);
  }

  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
        case "suggestFix":
        case "explainCode":
        case "listTenThings":
          setSuggestion(event.data.value);
          setResponseLoading(false);
          break;
        case "traceback":
          setTraceback(event.data.value);
          launchFindSuspiciousCode(event.data.value);
          break;
        case "workspacePath":
          dispatch(setWorkspacePath(event.data.value));
          break;
      }
    };
    window.addEventListener("message", eventListener);

    return () => window.removeEventListener("message", eventListener);
  }, [debugContext, selectedRanges]);

  return (
    <div className="mx-5">
      <h1>Debug Panel</h1>

      <H3>Code Sections</H3>
      <CodeMultiselect></CodeMultiselect>

      <H3>Bug Description</H3>
      <TextArea
        id="bugDescription"
        name="bugDescription"
        className="bugDescription"
        rows={4}
        cols={50}
        placeholder="Describe your bug..."
      ></TextArea>

      <H3>Stack Trace</H3>
      <TextArea
        id="traceback"
        className="traceback"
        name="traceback"
        rows={4}
        cols={50}
        placeholder="Paste stack trace here"
        onChange={(e) => {
          setTraceback(e.target.value);
          dispatch(updateValue({ key: "traceback", value: e.target.value }));
          // postVscMessageWithDebugContext("findSuspiciousCode");
        }}
        onPaste={(e) => {
          let pasted = e.clipboardData.getData("text");
          console.log("PASTED", pasted);
          setTraceback(pasted);
          launchFindSuspiciousCode(pasted);
        }}
        value={traceback}
      ></TextArea>

      <select
        hidden
        id="relevantVars"
        className="relevantVars"
        name="relevantVars"
      ></select>

      <ButtonDiv>
        <Button
          onClick={() => {
            postVscMessageWithDebugContext("explainCode");
            setResponseLoading(true);
          }}
        >
          Explain Code
        </Button>
        <Button
          onClick={() => {
            postVscMessageWithDebugContext("suggestFix");
            setResponseLoading(true);
          }}
        >
          Generate Ideas
        </Button>
        <Button
          disabled={selectedRanges.length === 0}
          onClick={async () => {
            withProgress("Generating Fix", async () => {
              let edits = await editCache.getEdit(debugContext);
              postVscMessage("makeEdit", { edits });
            });
          }}
        >
          Suggest Fix
        </Button>
        <Button
          disabled={selectedRanges.length === 0}
          onClick={() => {
            postVscMessageWithDebugContext("generateUnitTest");
          }}
        >
          Create Test
        </Button>
      </ButtonDiv>
      <Loader hidden={!responseLoading}></Loader>

      <Pre
        className="fixSuggestion"
        hidden={!(typeof suggestion === "string" && suggestion.length > 0)}
      >
        {suggestion}
      </Pre>

      <br></br>
    </div>
  );
}

export default MainTab;

import { postToIde } from "core/ide/messaging";
import React, { useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, Input } from "..";
import useSubmenuContextProviders from "../../hooks/useSubmenuContextProviders";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

function AddDocsDialog() {
  const [docsUrl, setDocsUrl] = React.useState("");
  const [docsTitle, setDocsTitle] = React.useState("");
  const [urlValid, setUrlValid] = React.useState(false);
  const dispatch = useDispatch();

  const { addItem } = useSubmenuContextProviders();

  const ref = React.useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, [ref]);

  return (
    <div className="p-4">
      <h3>Add Docs</h3>

      <Input
        type="url"
        placeholder="URL"
        value={docsUrl}
        ref={ref}
        onChange={(e) => {
          setDocsUrl(e.target.value);
          setUrlValid(e.target.validity.valid);
        }}
      />
      <Input
        type="text"
        placeholder="Title"
        value={docsTitle}
        onChange={(e) => setDocsTitle(e.target.value)}
      />

      <Button
        disabled={!docsUrl || !urlValid}
        className="ml-auto"
        onClick={() => {
          postToIde("addDocs", { url: docsUrl, title: docsTitle });
          setDocsTitle("");
          setDocsUrl("");
          dispatch(setShowDialog(false));
          addItem("docs", {
            id: docsUrl,
            title: docsTitle,
            description: new URL(docsUrl).hostname,
          });
        }}
      >
        Done
      </Button>
    </div>
  );
}

export default AddDocsDialog;

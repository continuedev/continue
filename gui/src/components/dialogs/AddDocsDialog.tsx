import { usePostHog } from "posthog-js/react";
import React, { useContext, useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, Input } from "..";
import { SubmenuContextProvidersContext } from "../../App";
import { setShowDialog } from "../../redux/slices/uiStateSlice";
import { postToIde } from "../../util/ide";

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

  const { addItem } = useContext(SubmenuContextProvidersContext);

  const ref = React.useRef<HTMLInputElement>(null);
  const posthog = usePostHog();

  useLayoutEffect(() => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
      }
    }, 100);
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
          postToIde("context/addDocs", { url: docsUrl, title: docsTitle });
          setDocsTitle("");
          setDocsUrl("");
          dispatch(setShowDialog(false));
          addItem("docs", {
            id: docsUrl,
            title: docsTitle,
            description: new URL(docsUrl).hostname,
          });
          posthog.capture("add_docs", { url: docsUrl });
        }}
      >
        Done
      </Button>
    </div>
  );
}

export default AddDocsDialog;

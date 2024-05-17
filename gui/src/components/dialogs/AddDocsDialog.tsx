import { usePostHog } from "posthog-js/react";
import React, { useContext, useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, Input } from "..";
import { SubmenuContextProvidersContext } from "../../App";
import { setShowDialog } from "../../redux/slices/uiStateSlice";
import { postToIde } from "../../util/ide";
import { SiteIndexingConfig } from "core/indexing/docs/preIndexedDocs";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

function AddDocsDialog() {
  const defaultMaxDepth = 4
  const [docsUrl, setDocsUrl] = React.useState("");
  const [docsTitle, setDocsTitle] = React.useState("");
  const [urlValid, setUrlValid] = React.useState(false);
  const [maxDepth, setMaxDepth] = React.useState(defaultMaxDepth);
  const [maxDepthValid, setMaxDepthValid] = React.useState(false)  // ToDo

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

      <p>
        Continue pre-indexes many common documentation sites, but if there's one
        you don't see in the dropdown, enter the URL here. Continue's indexing
        engine will crawl the site and generate embeddings so that you can ask
        questions.
      </p>

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
      <Input
        type="text"
        placeholder={`Max Depth (Default=${defaultMaxDepth})`}
        value={maxDepth}
        onChange={(e) => setMaxDepth(Number(e.target.value))}
      />
      <Button
        disabled={!docsUrl || !urlValid}
        className="ml-auto"
        onClick={() => {
          const siteindexingConfig = { url: docsUrl, title: docsTitle, maxDepth:maxDepth }
          postToIde("context/addDocs", siteindexingConfig);
          setDocsTitle("");
          setDocsUrl("");
          setMaxDepth(defaultMaxDepth)
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

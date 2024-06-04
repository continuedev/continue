import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import React, { useContext, useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { SubmenuContextProvidersContext } from "../../context/SubmenuContextProviders";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

function AddDocsDialog() {
  const defaultMaxDepth = 3;
  const [docsUrl, setDocsUrl] = React.useState("");
  const [docsTitle, setDocsTitle] = React.useState("");
  const [urlValid, setUrlValid] = React.useState(false);
  const [maxDepth, setMaxDepth] = React.useState<number | string>(""); // Change here

  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);
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
        placeholder={`Optional: Max Depth (Default: ${defaultMaxDepth})`}
        title="The maximum search tree depth - where your input url is the root node"
        value={maxDepth}
        onChange={(e) => {
          const value = e.target.value;
          if (value == "") {
            setMaxDepth("");
          } else if (!isNaN(+value) && Number(value) > 0) {
            setMaxDepth(Number(value));
          }
        }}
      />
      <Button
        disabled={!docsUrl || !urlValid}
        className="ml-auto"
        onClick={() => {
          const siteIndexingConfig: SiteIndexingConfig = {
            startUrl: docsUrl,
            rootUrl: docsUrl,
            title: docsTitle,
            maxDepth: typeof maxDepth === "string" ? defaultMaxDepth : maxDepth, // Ensure maxDepth is a number
          };
          ideMessenger.post("context/addDocs", siteIndexingConfig);
          setDocsTitle("");
          setDocsUrl("");
          setMaxDepth("");
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

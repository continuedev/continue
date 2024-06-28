import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import React, { useContext, useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import { Button, Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { SubmenuContextProvidersContext } from "../../context/SubmenuContextProviders";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const DEFAULT_MAX_DEPTH = 3;

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const [docsUrl, setDocsUrl] = React.useState("");
  const [docsTitle, setDocsTitle] = React.useState("");
  const [urlValid, setUrlValid] = React.useState(false);
  const [maxDepth, setMaxDepth] = React.useState<number | string>("");

  const ideMessenger = useContext(IdeMessengerContext);
  const { addItem } = useContext(SubmenuContextProvidersContext);

  const isFormValid = docsUrl && docsTitle && urlValid;

  function onSubmit(e) {
    e.preventDefault();

    const siteIndexingConfig: SiteIndexingConfig = {
      startUrl: docsUrl,
      rootUrl: docsUrl,
      title: docsTitle,
      maxDepth: typeof maxDepth === "string" ? DEFAULT_MAX_DEPTH : maxDepth,
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
  }

  return (
    <div className="p-4">
      <div className="mb-8">
        <h2>Add Docs</h2>

        <p>
          Continue pre-indexes many common documentation sites, but if there's
          one you don't see in the dropdown, enter the URL here.
        </p>

        <p>
          Continue's indexing engine will crawl the site and generate embeddings
          so that you can ask questions.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col space-y-4">
        <label>
          URL
          <Input
            autoFocus
            type="url"
            placeholder="URL"
            value={docsUrl}
            onChange={(e) => {
              setDocsUrl(e.target.value);
              setUrlValid(e.target.validity.valid);
            }}
          />
        </label>

        <label>
          Title
          <Input
            type="text"
            placeholder="Title"
            value={docsTitle}
            onChange={(e) => setDocsTitle(e.target.value)}
          />
        </label>

        <label>
          Max Depth [Optional]
          <Input
            type="text"
            inputMode="numeric"
            placeholder={`Max depth (Default: ${DEFAULT_MAX_DEPTH})`}
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
        </label>

        <Button disabled={!isFormValid} className="ml-auto" type="submit">
          Done
        </Button>
      </form>
    </div>
  );
}

export default AddDocsDialog;

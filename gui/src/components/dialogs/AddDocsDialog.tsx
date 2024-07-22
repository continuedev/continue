import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import React, { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Button, Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { SubmenuContextProvidersContext } from "../../context/SubmenuContextProviders";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const DEFAULT_MAX_DEPTH = 3;

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const ref = useRef<HTMLInputElement>(null);

  const [docsUrl, setDocsUrl] = useState("");
  const [docsTitle, setDocsTitle] = useState("");
  const [urlValid, setUrlValid] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number | string>("");

  const ideMessenger = useContext(IdeMessengerContext);
  const { addItem } = useContext(SubmenuContextProvidersContext);

  const isFormValid = docsUrl && docsTitle && urlValid;

  useLayoutEffect(() => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
      }
    }, 100);
  }, [ref]);

  function onSubmit(e) {
    e.preventDefault();

    const siteIndexingConfig: SiteIndexingConfig = {
      startUrl: docsUrl,
      rootUrl: docsUrl,
      title: docsTitle,
      maxDepth: typeof maxDepth === "string" ? DEFAULT_MAX_DEPTH : maxDepth,
      faviconUrl: new URL("/favicon.ico", docsUrl).toString(),
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
            type="url"
            placeholder="URL"
            value={docsUrl}
            ref={ref}
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

        <div className="flex justify-end">
          <Button disabled={!isFormValid} type="submit">
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AddDocsDialog;

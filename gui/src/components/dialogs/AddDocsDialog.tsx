import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Button, HelperText, Input, lightGray } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const DEFAULT_MAX_DEPTH = 3;

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const ref = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [rootUrl, setRootUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState<number | string>("");
  const [isOpen, setIsOpen] = useState(false);

  const ideMessenger = useContext(IdeMessengerContext);

  const isFormValid = startUrl && title;

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
      startUrl,
      rootUrl,
      title,
      maxDepth: typeof maxDepth === "string" ? DEFAULT_MAX_DEPTH : maxDepth,
      faviconUrl: new URL("/favicon.ico", startUrl).toString(),
    };

    ideMessenger.post("context/addDocs", siteIndexingConfig);

    setTitle("");
    setStartUrl("");
    setRootUrl("");
    setMaxDepth("");
    setFaviconUrl("");

    dispatch(setShowDialog(false));

    posthog.capture("add_docs_gui", { url: startUrl });
  }

  return (
    <div className="p-4">
      <div className="mb-8">
        <h1>Add a documentation site</h1>

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
          Title
          <Input
            type="text"
            placeholder="Title"
            value={title}
            ref={ref}
            onChange={(e) => setTitle(e.target.value)}
          />
          <HelperText>
            The title that will be displayed to users in the `@docs` submenu
          </HelperText>
        </label>

        <label>
          Start URL
          <Input
            type="url"
            placeholder="Start URL"
            value={startUrl}
            onChange={(e) => {
              setStartUrl(e.target.value);
            }}
          />
          <HelperText>
            The starting location to begin crawling the documentation site
          </HelperText>
        </label>

        <div
          className="cursor-pointer"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? (
            <ChevronUpIcon
              width="1.0em"
              height="1.0em"
              style={{ color: lightGray }}
            ></ChevronUpIcon>
          ) : (
            <ChevronDownIcon
              width="1.0em"
              height="1.0em"
              style={{ color: lightGray }}
            ></ChevronDownIcon>
          )}
          <span className="ms-1">Advanced</span>
        </div>

        {isOpen && (
          <div className="pt-2">
            <label>
              Root URL [Optional]
              <Input
                type="url"
                placeholder="Root URL"
                value={rootUrl}
                onChange={(e) => {
                  setRootUrl(e.target.value);
                }}
              />
              <HelperText>
                Limits the crawler to pages within the same domain and path as
                the Root URL
              </HelperText>
            </label>

            <label>
              Favicon URL [Optional]
              <Input
                type="url"
                placeholder={`${startUrl}/favicon.ico`}
                value={faviconUrl}
                onChange={(e) => {
                  setFaviconUrl(e.target.value);
                }}
              />
              <HelperText>
                The URL path to a favicon for the site - by default, it will be
                `/favicon.ico` path from the Start URL
              </HelperText>
            </label>

            <label>
              Max Depth [Optional]
              <Input
                type="text"
                inputMode="numeric"
                placeholder={`Default: ${DEFAULT_MAX_DEPTH}`}
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
              <HelperText>
                Limits the maximum search tree depth of the crawler - 3 by
                default
              </HelperText>
            </label>
          </div>
        )}

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

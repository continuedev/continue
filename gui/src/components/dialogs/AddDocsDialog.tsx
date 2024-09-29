import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Button, HelperText, Input, lightGray } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const ref = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
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

  function onSubmit(e: any) {
    e.preventDefault();

    const siteIndexingConfig: SiteIndexingConfig = {
      startUrl,
      title,
      faviconUrl,
    };

    ideMessenger.post("context/addDocs", siteIndexingConfig);

    setTitle("");
    setStartUrl("");
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

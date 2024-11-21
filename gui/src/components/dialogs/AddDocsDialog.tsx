import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, HelperText, Input, lightGray, SecondaryButton } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import IndexingStatusViewer from "../indexing/IndexingStatus";
import { C } from "core/autocomplete/constants/AutocompleteLanguageInfo";

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const ref = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [submittedConfig, setSubmittedConfig] = useState<SiteIndexingConfig>();

  const ideMessenger = useContext(IdeMessengerContext);
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexing.statuses,
  );

  const docsSuggestions = useSelector(
    (store: RootState) => store.state.docsSuggestions,
  );

  const docsByLanguage = useMemo(() => {
    console.log(docsSuggestions);
    const languages = Object.keys(docsSuggestions);
    return languages.map((language) => {
      return {
        language,
        packages: docsSuggestions[language],
      };
    });
  }, [docsSuggestions]);

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

    setSubmittedConfig(siteIndexingConfig);
    setTitle("");
    setStartUrl("");
    setFaviconUrl("");

    posthog.capture("add_docs_gui", { url: startUrl });
  }

  if (submittedConfig) {
    const status = indexingStatuses[submittedConfig.startUrl];
    return (
      <div className="flex flex-col p-4">
        <div className="flex flex-row items-center gap-2">
          <CheckCircleIcon className="h-8 w-8" />
          <h1>{`Docs added`}</h1>
        </div>
        <div className="flex flex-col gap-1 text-stone-500">
          <p className="m-0 p-0">Title: {submittedConfig.title}</p>
          <p className="m-0 p-0">Start URL: {submittedConfig.startUrl}</p>
          {submittedConfig.rootUrl && (
            <p className="m-0 p-0">Root URL: {submittedConfig.rootUrl}</p>
          )}
          {submittedConfig.maxDepth && (
            <p className="m-0 p-0">Max depth: {submittedConfig.maxDepth}</p>
          )}
          {submittedConfig.faviconUrl && (
            <p className="m-0 p-0">Favicon URL: {submittedConfig.faviconUrl}</p>
          )}
        </div>
        {!!status && (
          <div className="mt-4 flex flex-col divide-x-0 divide-y-2 divide-solid divide-zinc-700">
            <p className="m-0 mb-5 p-0 leading-snug">{`Type "@docs" and select ${submittedConfig.title} to reference these docs once indexing is complete. Check indexing status from the "More" page.`}</p>
            <div className="pt-1">
              <IndexingStatusViewer status={status} />
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-row items-center justify-end gap-4">
          <SecondaryButton
            className=""
            onClick={() => {
              setSubmittedConfig(undefined);
            }}
          >
            Add another
          </SecondaryButton>
          <Button
            className=""
            onClick={() => {
              dispatch(setDialogMessage(undefined));
              dispatch(setShowDialog(false));
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-8">
        <h1>Add documentation</h1>
        {docsByLanguage.map(({ language, packages }) => {
          return (
            <div key={language}>
              <h1>{language}</h1>
              <div>
                {packages.map((pkg) => {
                  return (
                    <div>
                      <p>{pkg.packageInfo.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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

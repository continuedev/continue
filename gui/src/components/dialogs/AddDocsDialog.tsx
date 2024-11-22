import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeBracketIcon,
  InformationCircleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { PackageDocsResult, SiteIndexingConfig } from "core";
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

import { ToolTip } from "../gui/Tooltip";

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

  const handleSelectSuggestion = (docsResult: PackageDocsResult) => {};

  // if (submittedConfig) {
  //   const status = indexingStatuses[submittedConfig.startUrl];
  //   return (
  //     <div className="flex flex-col p-4">
  //       <div className="flex flex-row items-center gap-2">
  //         <CheckCircleIcon className="h-8 w-8" />
  //         <h1>{`Docs added`}</h1>
  //       </div>
  //       <div className="flex flex-col gap-1 text-stone-500">
  //         <p className="m-0 p-0">Title: {submittedConfig.title}</p>
  //         <p className="m-0 p-0">Start URL: {submittedConfig.startUrl}</p>
  //         {submittedConfig.rootUrl && (
  //           <p className="m-0 p-0">Root URL: {submittedConfig.rootUrl}</p>
  //         )}
  //         {submittedConfig.maxDepth && (
  //           <p className="m-0 p-0">Max depth: {submittedConfig.maxDepth}</p>
  //         )}
  //         {submittedConfig.faviconUrl && (
  //           <p className="m-0 p-0">Favicon URL: {submittedConfig.faviconUrl}</p>
  //         )}
  //       </div>
  //       {!!status && (
  //         <div className="mt-4 flex flex-col divide-x-0 divide-y-2 divide-solid divide-zinc-700">
  //           <p className="m-0 mb-5 p-0 leading-snug">{`Type "@docs" and select ${submittedConfig.title} to reference these docs once indexing is complete. Check indexing status from the "More" page.`}</p>
  //           <div className="pt-1">
  //             <IndexingStatusViewer status={status} />
  //           </div>
  //         </div>
  //       )}
  //       <div className="mt-4 flex flex-row items-center justify-end gap-4">
  //         <SecondaryButton
  //           className=""
  //           onClick={() => {
  //             setSubmittedConfig(undefined);
  //           }}
  //         >
  //           Add another
  //         </SecondaryButton>
  //         <Button
  //           className=""
  //           onClick={() => {
  //             dispatch(setDialogMessage(undefined));
  //             dispatch(setShowDialog(false));
  //           }}
  //         >
  //           Done
  //         </Button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="p-4">
      <div className="mb-8">
        <h1>Add documentation</h1>
        {docsSuggestions.length ? (
          <div className="no-scrollbar max-h-[300px] overflow-y-auto">
            <table className="border-collapse p-0">
              <thead className="bg-vsc-background sticky -top-1 font-bold">
                <tr className="">
                  <td className="pr-1">
                    <CodeBracketIcon className="h-3.5 w-3.5" />
                  </td>
                  <td className="pr-1">Title</td>
                  {/* <td className="pr-1">Version</td> */}
                  <td className="pr-1">Start Link</td>
                  <td></td>
                </tr>
              </thead>
              <tbody className="p-0">
                <tr className="whitespace-nowrap">Add docs</tr>
                {docsSuggestions.map((docsResult) => {
                  const { error, details } = docsResult;
                  const { language, name, version } = docsResult.packageInfo;
                  const id = `${language}-${name}-${version}`;
                  return (
                    <tr key={id} className="p-0">
                      <td>
                        <input type="checkbox"></input>
                      </td>
                      <td>{name}</td>
                      {/* <td>{version}</td> */}
                      <td className="">
                        {error ? (
                          <span className="text-vsc-input-border italic">
                            No docs link found
                          </span>
                        ) : (
                          <span className="flex flex-row items-center gap-2">
                            <div>
                              <LinkIcon className="h-2 w-2" />
                            </div>
                            <p className="lines lines-1 m-0 p-0">
                              {details.docsLink}
                            </p>
                          </span>
                        )}
                      </td>
                      <td>
                        <InformationCircleIcon
                          data-tooltip-id={id}
                          className="text-vsc-foreground-muted h-3.5 w-3.5 cursor-help"
                        />

                        <ToolTip id={id} place="bottom">
                          <p className="m-0 p-0">{`Version: ${version}`}</p>
                          <p className="m-0 p-0">{`Found in ${docsResult.packageInfo.packageFile.path}`}</p>
                        </ToolTip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <p>
          Continue pre-indexes many common documentation sites, but if there's
          one you don't see in the dropdown, enter the URL here.
        </p>

        <p>
          Continue's indexing engine will crawl the site and generate embeddings
          so that you can ask questions.
        </p>
      </div>
      {/* 
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
      </form> */}
    </div>
  );
}

export default AddDocsDialog;

import {
  CheckIcon,
  InformationCircleIcon,
  PencilIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { IndexingStatus, PackageDocsResult, SiteIndexingConfig } from "core";
import { usePostHog } from "posthog-js/react";
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Input, SecondaryButton } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { ToolTip } from "../gui/Tooltip";
import FileIcon from "../FileIcon";
import DocsIndexingPeeks from "../indexing/DocsIndexingPeeks";
import preIndexedDocs from "core/indexing/docs/preIndexedDocs";
import { updateIndexingStatus } from "../../redux/slices/indexingSlice";
import { useAppSelector } from "../../redux/hooks";

function AddDocsDialog() {
  const posthog = usePostHog();
  const dispatch = useDispatch();

  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  const ideMessenger = useContext(IdeMessengerContext);
  const indexingStatuses = useAppSelector(
    (store) => store.indexing.indexing.statuses,
  );

  const docsIndexingStatuses: IndexingStatus[] = useMemo(() => {
    return Object.values(indexingStatuses).filter(
      (status) => status.type === "docs" && status.status === "indexing",
    );
  }, [indexingStatuses]);

  const docsSuggestions = useAppSelector((store) => store.misc.docsSuggestions);
  const configDocs = useAppSelector((store) => store.config.config.docs);

  const sortedDocsSuggestions = useMemo(() => {
    const docsFromConfig = configDocs ?? [];
    const filtered = docsSuggestions.filter((sug) => {
      const startUrl = sug.details?.docsLink;
      return (
        !docsFromConfig.find((d) => d.startUrl === startUrl) &&
        !docsIndexingStatuses.find((s) => s.id === startUrl) &&
        (startUrl ? !preIndexedDocs[startUrl] : true)
      );
    });

    filtered.sort((a, b) => {
      const rank = (result: PackageDocsResult) => {
        if (result.error) {
          return 2;
        } else if (result.details?.docsLinkWarning) {
          return 1;
        } else {
          return 0;
        }
      };
      return rank(a) - rank(b);
    });
    return filtered;
  }, [docsSuggestions, configDocs, docsIndexingStatuses]);

  const isFormValid = startUrl && title;

  useLayoutEffect(() => {
    setTimeout(() => {
      if (titleRef.current) {
        titleRef.current.focus();
      }
    }, 100);
  }, [titleRef]);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

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

    posthog.capture("add_docs_gui", { url: startUrl });

    // Optimistic status update
    dispatch(
      updateIndexingStatus({
        type: "docs",
        description: "Initializing",
        id: startUrl,
        embeddingsProviderId: "mock-embeddings-provider-id",
        progress: 0,
        status: "indexing",
        title,
        url: startUrl,
      }),
    );
  }

  const handleSelectSuggestion = (docsResult: PackageDocsResult) => {
    if (docsResult.error || !docsResult.details) {
      setTitle(docsResult.packageInfo.name);
      setStartUrl("");
      urlRef.current?.focus();
      return;
    }
    const suggestedTitle =
      docsResult.details.title ?? docsResult.packageInfo.name;
    if (docsResult.details?.docsLinkWarning) {
      setTitle(suggestedTitle);
      setStartUrl(docsResult.details.docsLink);
      urlRef.current?.focus();
      return;
    }
    const siteIndexingConfig: SiteIndexingConfig = {
      startUrl: docsResult.details.docsLink,
      title: suggestedTitle,
      faviconUrl: undefined,
    };

    ideMessenger.post("context/addDocs", siteIndexingConfig);

    posthog.capture("add_docs_gui", { url: startUrl });

    // Optimistic status update
    dispatch(
      updateIndexingStatus({
        type: "docs",
        description: "Initializing",
        id: docsResult.details.docsLink,
        embeddingsProviderId: "mock-embeddings-provider-id",
        progress: 0,
        status: "indexing",
        title: docsResult.details.title ?? docsResult.packageInfo.name,
        url: docsResult.details.docsLink,
      }),
    );
  };

  return (
    <div className="px-2 pt-4 sm:px-4">
      <div className="">
        <h1 className="mb-0 hidden sm:block">Add documentation</h1>
        <h1 className="sm:hidden">Add docs</h1>
        <p className="m-0 mt-2 p-0 text-stone-500">
          For the @docs context provider
        </p>
        {!!sortedDocsSuggestions.length && (
          <p className="m-0 mb-1 mt-4 p-0 font-semibold">Suggestions</p>
        )}
        <div className="border-vsc-foreground-muted max-h-[145px] overflow-y-scroll rounded-sm py-1 pr-2">
          {sortedDocsSuggestions.map((docsResult) => {
            const { error, details } = docsResult;
            const { language, name, version } = docsResult.packageInfo;
            const id = `${language}-${name}-${version}`;
            return (
              <div
                key={id}
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center px-1 py-1 hover:bg-gray-200/10"
                onClick={() => {
                  handleSelectSuggestion(docsResult);
                }}
              >
                <div className="pr-1">
                  {error || details?.docsLinkWarning ? (
                    <div>
                      <PencilIcon
                        data-tooltip-id={id + "-edit"}
                        className="vsc-foreground-muted h-3 w-3"
                      />
                      <ToolTip id={id + "-edit"} place="bottom">
                        This may not be a docs page
                      </ToolTip>
                    </div>
                  ) : (
                    <PlusIcon className="text-foreground-muted h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="hidden sm:block">
                    <FileIcon
                      filename={`x.${language}`}
                      height="1rem"
                      width="1rem"
                    />
                  </div>
                  <span className="lines lines-1">{name}</span>
                </div>
                <div>
                  {error || !details?.docsLink ? (
                    <span className="text-vsc-foreground-muted italic">
                      No docs link found
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* <div>
                        <LinkIcon className="h-2 w-2" />
                      </div> */}
                      <p
                        className="lines lines-1 m-0 p-0 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          ideMessenger.post("openUrl", details.docsLink);
                        }}
                      >
                        {details.docsLink}
                      </p>
                    </div>
                  )}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <InformationCircleIcon
                    data-tooltip-id={id + "-info"}
                    className="text-vsc-foreground-muted h-3.5 w-3.5 select-none"
                  />
                  <ToolTip id={id + "-info"} place="bottom">
                    <p className="m-0 p-0">{`Version: ${version}`}</p>
                    <p className="m-0 p-0">{`Found in ${docsResult.packageInfo.packageFile.path}`}</p>
                  </ToolTip>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <form onSubmit={onSubmit} className="flex flex-col gap-1">
            <div className="flex flex-row gap-2">
              <label className="flex min-w-16 basis-1/4 flex-col gap-1">
                <div className="flex flex-row items-center gap-1">
                  <span>Title</span>
                  <div>
                    <InformationCircleIcon
                      data-tooltip-id={"add-docs-form-title"}
                      className="text-vsc-foreground-muted h-3.5 w-3.5 select-none"
                    />
                    <ToolTip id={"add-docs-form-title"} place="top">
                      The title that will be displayed to users in the `@docs`
                      submenu
                    </ToolTip>
                  </div>
                </div>

                <Input
                  type="text"
                  placeholder="Title"
                  value={title}
                  ref={titleRef}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="flex basis-3/4 flex-col gap-1">
                <div className="flex flex-row items-center gap-1">
                  <span className="lines lines-1 whitespace-nowrap">
                    Start URL
                  </span>
                  <div>
                    <InformationCircleIcon
                      data-tooltip-id={"add-docs-form-url"}
                      className="text-vsc-foreground-muted h-3.5 w-3.5 select-none"
                    />
                    <ToolTip id={"add-docs-form-url"} place="top">
                      The starting location to begin crawling the documentation
                      site
                    </ToolTip>
                  </div>
                </div>
                <Input
                  ref={urlRef}
                  type="url"
                  placeholder="Start URL"
                  value={startUrl}
                  onChange={(e) => {
                    setStartUrl(e.target.value);
                  }}
                />
              </label>
              {/* <div>
                <PlusCircleIcon className="h-5 w-5 self-end" />
              </div> */}
            </div>
            <div className="flex flex-row justify-end gap-2">
              <SecondaryButton
                className="min-w-16"
                disabled={!isFormValid}
                type="submit"
              >
                Add
              </SecondaryButton>
            </div>
          </form>
        </div>
      </div>

      <DocsIndexingPeeks statuses={docsIndexingStatuses} />
      <div className="flex flex-row items-end justify-between pb-3">
        <div>
          {docsIndexingStatuses.length ? (
            <p className="mt-2 flex flex-row items-center gap-1 p-0 px-1 text-xs text-stone-500">
              <CheckIcon className="h-3 w-3" />
              It is safe to close this form while indexing
            </p>
          ) : null}
        </div>
        {/* <Button className="min-w-16" onClick={closeDialog}>
          Done
        </Button> */}
      </div>
    </div>
  );
}

export default AddDocsDialog;

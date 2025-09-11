import { DocsIndexingDetails } from "core";
import { useCallback, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Tooltip } from "react-tooltip";
import { SecondaryButton } from "../../../../components";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";

interface DocsDetailsDialogProps {
  startUrl: string;
}

function DocsDetailsDialog({ startUrl }: DocsDetailsDialogProps) {
  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState<DocsIndexingDetails | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);

    try {
      const response = await ideMessenger.request("docs/getDetails", {
        startUrl,
      });
      if (response.status === "error") {
        throw new Error(response.error);
      }
      setData(response.content);
    } catch (error) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, []);

  let comp = <div>Loading...</div>;
  if (!isLoading) {
    if (isError) {
      comp = (
        <div>
          <div>Error fetching docs details</div>
          <SecondaryButton onClick={fetchData}>Try again</SecondaryButton>
        </div>
      );
    }
    if (data) {
      comp = (
        <div className="flex flex-col gap-0.5">
          <p className="m-0 mt-2 p-0 text-stone-500">{`Title: ${data.config.title}`}</p>
          {!data.chunks?.length ? (
            <div>No article chunks</div>
          ) : (
            <div className="relative mt-2 h-[300px] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-vsc-background sticky top-0 text-left">
                  <tr>
                    <th className="py-1">Filepath</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody className="h-20 overflow-y-scroll">
                  {data.chunks.map((chunk, i) => {
                    const contentToolTipId = `docs-content-peek-${i}`;
                    const urlToolTipId = `docs-url-peek-${i}`;
                    return (
                      <>
                        <tr key={i} className="">
                          <td
                            className="cursor-pointer px-1"
                            data-tooltip-id={urlToolTipId}
                            data-tooltip-delay-show={500}
                          >
                            <span className="truncate-start max-w-[200px]">
                              {chunk.filepath}
                            </span>
                          </td>
                          <td
                            className="cursor-pointer px-1"
                            data-tooltip-id={contentToolTipId}
                            data-tooltip-delay-show={500}
                          >
                            <span className="line-clamp-1">
                              {chunk.content}
                            </span>
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
              {/* Rending tooltips here because div can't be child of tbody apparently */}
              {data.chunks.map((chunk, i) => {
                const contentToolTipId = `docs-content-peek-${i}`;
                const urlToolTipId = `docs-url-peek-${i}`;
                return (
                  <>
                    <Tooltip
                      key={urlToolTipId}
                      id={urlToolTipId}
                      place="top"
                      className="max-w-full"
                    >
                      {chunk.filepath}
                    </Tooltip>
                    <Tooltip
                      key={contentToolTipId}
                      id={contentToolTipId}
                      place="top"
                      className="max-h-[300px] max-w-[170px] overflow-y-auto"
                    >
                      {chunk.content}
                    </Tooltip>
                  </>
                );
              })}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="px-2 py-4 sm:px-4">
      <h3>Docs index</h3>
      <p
        className="text-lightgray m-0 mt-1 cursor-pointer p-0 hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          ideMessenger.post("openUrl", startUrl);
        }}
      >
        {startUrl}
      </p>
      {comp}
      <div className="flex flex-row justify-end">
        <SecondaryButton onClick={closeDialog}>Close</SecondaryButton>
      </div>
    </div>
  );
}

export default DocsDetailsDialog;

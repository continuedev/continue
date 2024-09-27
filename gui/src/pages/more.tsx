import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";
import { IndexingProgressUpdate } from "core";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vscBackground } from "../components";
import KeyboardShortcutsDialog from "../components/dialogs/KeyboardShortcuts";
import IndexingProgressBar from "../components/loaders/IndexingProgressBar";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useDispatch } from "react-redux";
import { setOnboardingCard } from "../redux/slices/uiStateSlice";
import useHistory from "../hooks/useHistory";

interface MoreActionRowProps {
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
}

function MoreActionRow({
  title,
  description,
  onClick,
  href,
}: MoreActionRowProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4/5 truncate flex flex-col justify-center">
        <h3 className="text-sm my-0">{title}</h3>
        <span className="text-gray-400 py-1">{description}</span>
      </div>

      <div
        className="flex justify-end w-1/5 cursor-pointer w-5 h-5 text-gray-400"
        onClick={onClick}
      >
        {href ? <ArrowTopRightOnSquareIcon /> : <DocumentArrowUpIcon />}
      </div>
    </div>
  );
}

function MorePage() {
  useNavigationListener();

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const { saveSession } = useHistory(dispatch);

  const [indexingState, setIndexingState] = useState<IndexingProgressUpdate>({
    desc: "Loading indexing config",
    progress: 0.0,
    status: "loading",
  });

  useWebviewListener("indexProgress", async (data) => {
    setIndexingState(data);
  });

  return (
    <div className="overflow-y-scroll">
      <div
        onClick={() => navigate("/")}
        className="items-center flex m-0 p-0 sticky top-0 cursor-pointer border-0 border-b border-solid border-b-zinc-700 bg-inherit"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon className="inline-block ml-3 cursor-pointer w-3 h-3" />
        <span className="text-sm font-bold m-2 inline-block">Chat</span>
      </div>

      <div className="px-4 divide-y-2 divide-y divide-zinc-700 divide-solid divide-x-0 gap-2">
        <div className="py-5">
          <div>
            <h3 className="mx-auto text-xl mb-1 mt-0">@codebase index</h3>
            <span className="text-xs text-gray-400 w-3/4">
              Embeddings of your codebase. All code is stored locally.
            </span>
          </div>
          <IndexingProgressBar indexingState={indexingState} />
        </div>

        <div className="py-5">
          <h3 className="text-xl mb-4 mt-0">Temp text</h3>
          <div className="flex flex-col gap-5">
            <MoreActionRow
              title="Token usage"
              description="Daily token usage across models"
              onClick={() => navigate("/stats")}
            />

            <MoreActionRow
              title="Quickstart"
              description="Reopen the quickstart and tutorial file"
              onClick={() => {
                navigate("/");
                // Used to clear the chat panel before showing onboarding card
                saveSession();
                dispatch(setOnboardingCard({ show: true, activeTab: "Best" }));
                ideMessenger.post("showTutorial", undefined);
              }}
            />
          </div>
        </div>

        <div className="py-5">
          <h3 className="text-xl mb-4 mt-0">Help center</h3>
          <div className="flex flex-col gap-5">
            <MoreActionRow
              title="Documentation"
              description="Learn how to configure and use Continue"
              href="https://docs.continue.dev/"
            />

            <MoreActionRow
              title="Have an issue?"
              description="Let us know on GitHub and we'll do our best to resolve it"
              href="https://github.com/continuedev/continue/issues/new/choose"
            />

            <MoreActionRow
              title="Join the community!"
              description="Join us on Discord to stay up-to-date on the latest developments"
              href="https://discord.gg/vapESyrFmJ"
            />

            <MoreActionRow
              title="Quickstart"
              description="Reopen the quickstart and tutorial file"
              onClick={() => {
                navigate("/");
                // Used to clear the chat panel before showing onboarding card
                saveSession();
                dispatch(setOnboardingCard({ show: true, activeTab: "Best" }));
                ideMessenger.post("showTutorial", undefined);
              }}
            />

            <MoreActionRow
              title="Quickstart"
              description="Reopen the quickstart and tutorial file"
              onClick={() => {
                navigate("/");
                // Used to clear the chat panel before showing onboarding card
                saveSession();
                dispatch(setOnboardingCard({ show: true, activeTab: "Best" }));
                ideMessenger.post("showTutorial", undefined);
              }}
            />
          </div>
        </div>

        <div>
          <h3 className="mx-auto text-lg mb-1">Keyboard shortcuts</h3>
          <KeyboardShortcutsDialog />
        </div>
      </div>
    </div>
  );
}

export default MorePage;

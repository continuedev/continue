import {
  ArrowTopRightOnSquareIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { setOnboardingCard } from "../../redux/slices/uiSlice";
import { saveCurrentSession } from "../../redux/thunks/session";
import MoreHelpRow from "./MoreHelpRow";

export function HelpCenterSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  return (
    <div className="py-5">
      <h3 className="mb-4 mt-0 text-xl">Help center</h3>
      <div className="-mx-4 flex flex-col">
        <MoreHelpRow
          title="Documentation"
          description="Learn how to configure and use Continue"
          Icon={ArrowTopRightOnSquareIcon}
          onClick={() =>
            ideMessenger.post("openUrl", "https://docs.continue.dev/")
          }
        />

        <MoreHelpRow
          title="Have an issue?"
          description="Let us know on GitHub and we'll do our best to resolve it"
          Icon={ArrowTopRightOnSquareIcon}
          onClick={() =>
            ideMessenger.post(
              "openUrl",
              "https://github.com/continuedev/continue/issues/new/choose",
            )
          }
        />

        <MoreHelpRow
          title="Join the community!"
          description="Join us on Discord to stay up-to-date on the latest developments"
          Icon={ArrowTopRightOnSquareIcon}
          onClick={() =>
            ideMessenger.post("openUrl", "https://discord.gg/vapESyrFmJ")
          }
        />

        <MoreHelpRow
          title="Token usage"
          description="Daily token usage across models"
          Icon={TableCellsIcon}
          onClick={() => navigate("/stats")}
        />

        <MoreHelpRow
          title="Quickstart"
          description="Reopen the quickstart and tutorial file"
          Icon={DocumentArrowUpIcon}
          onClick={async () => {
            navigate("/");
            // Used to clear the chat panel before showing onboarding card
            await dispatch(
              saveCurrentSession({
                openNewSession: true,
                generateTitle: true,
              }),
            );
            dispatch(setOnboardingCard({ show: true, activeTab: "Best" }));
            ideMessenger.post("showTutorial", undefined);
          }}
        />
      </div>
    </div>
  );
}

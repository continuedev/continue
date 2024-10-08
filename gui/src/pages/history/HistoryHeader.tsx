import { useNavigate } from "react-router-dom";
import { lightGray, vscBackground } from "../../components";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getFontSize } from "../../util";

export const HistoryHeader = () => {
  useNavigationListener();
  const navigate = useNavigate();

  return (
    <div
      className="sticky top-0"
      style={{ backgroundColor: vscBackground, fontSize: getFontSize() }}
    >
      <div
        className="items-center flex m-0 p-0"
        style={{
          borderBottom: `0.5px solid ${lightGray}`,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">History</h3>
      </div>
      {/* {workspacePaths && workspacePaths.length > 0 && (
      <CheckDiv
        checked={filteringByWorkspace}
        onClick={() => setFilteringByWorkspace((prev) => !prev)}
        title={`Show only sessions from ${lastPartOfPath(
          workspacePaths[workspacePaths.length - 1]
        )}/`}
      />
    )} */}
    </div>
  );
};

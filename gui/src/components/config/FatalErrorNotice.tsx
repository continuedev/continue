import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { ROUTES } from "../../util/navigation";
import { useLump } from "../mainInput/Lump/LumpContext";

export const FatalErrorIndicator = () => {
  const { refreshProfiles } = useAuth();
  const configError = useAppSelector((store) => store.config.configError);
  const ideMessenger = useContext(IdeMessengerContext);

  const navigate = useNavigate();

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const { setSelectedSection, selectedSection } = useLump();
  const configLoading = useAppSelector((state) => state.config.loading);

  const showLumpErrorSection = () => {
    navigate(ROUTES.HOME);
    setSelectedSection("error");
  };

  if (!hasFatalErrors) {
    return null;
  }

  return (
    <div
      className="bg-error z-50 px-4 py-3 text-center text-white"
      role="alert"
    >
      <strong className="font-bold">Error!</strong>{" "}
      <span className="block sm:inline">Could not load config</span>
      <div className="mt-2 flex flex-row items-center justify-center gap-3">
        <div
          onClick={() => {
            ideMessenger.post(
              "openUrl",
              "https://docs.continue.dev/troubleshooting",
            );
          }}
          className="cursor-pointer underline"
        >
          Help
        </div>
        {configLoading ? (
          <div>Reloading...</div>
        ) : (
          <div
            className={`cursor-pointer underline`}
            onClick={() => {
              refreshProfiles("Clicked reload in fatal indicator");
            }}
          >
            Reload
          </div>
        )}

        <div
          onClick={showLumpErrorSection}
          className={`cursor-pointer underline transition-all ${selectedSection === "error" ? "opacity-0" : ""}`}
        >
          View
        </div>
      </div>
    </div>
  );
};

import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { ROUTES } from "../../util/navigation";
import Alert from "../gui/Alert";
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

  const { selectedProfile } = useAuth();

  if (!hasFatalErrors) {
    return null;
  }

  const displayName = selectedProfile
    ? (selectedProfile.title ??
      `${selectedProfile.fullSlug?.ownerSlug}/${selectedProfile.fullSlug?.packageSlug}`)
    : "agent";

  return (
    <Alert type="error" className="mx-2 my-1 px-2">
      <span>{`Error loading`}</span>{" "}
      <span className="italic">{displayName}</span>
      {". "}
      <span>{`Chat is disabled until a model is available.`}</span>
      <div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
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
    </Alert>
  );
};

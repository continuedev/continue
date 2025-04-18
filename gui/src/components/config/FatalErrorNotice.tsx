import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../redux/hooks";
import { ROUTES } from "../../util/navigation";
import { useLump } from "../mainInput/Lump/LumpContext";

export const FatalErrorIndicator = () => {
  const configError = useAppSelector((store) => store.config.configError);

  const navigate = useNavigate();

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const { setSelectedSection } = useLump();

  const showLumpErrorSection = () => {
    navigate(ROUTES.HOME);
    setSelectedSection("error");
  };

  if (!hasFatalErrors) {
    return null;
  }
  return (
    <div
      className="z-50 cursor-pointer bg-red-600 p-4 text-center text-white"
      role="alert"
      onClick={showLumpErrorSection}
    >
      <strong className="font-bold">Error!</strong>{" "}
      <span className="block sm:inline">Could not load config</span>
      <div className="mt-2 underline">Learn More</div>
    </div>
  );
};

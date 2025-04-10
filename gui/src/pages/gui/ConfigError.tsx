import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderButtonWithToolTip from "../../components/gui/HeaderButtonWithToolTip";
import { useAppSelector } from "../../redux/hooks";
import { ROUTES } from "../../util/navigation";

const ConfigErrorIndicator = () => {
  const configError = useAppSelector((store) => store.config.configError);

  const navigate = useNavigate();
  const { pathname } = useLocation();

  function onClickError() {
    navigate(pathname === ROUTES.CONFIG_ERROR ? "/" : ROUTES.CONFIG_ERROR);
  }

  if (!configError?.length) {
    return null;
  }

  // TODO: add a tooltip
  return (
    <HeaderButtonWithToolTip
      tooltipPlacement="top-end"
      text="Config error"
      onClick={onClickError}
    >
      <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-600" />
    </HeaderButtonWithToolTip>
  );
};

export default ConfigErrorIndicator;

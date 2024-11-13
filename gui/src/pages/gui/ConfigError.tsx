import { useLocation, useNavigate } from "react-router-dom";
import HeaderButtonWithToolTip from "../../components/gui/HeaderButtonWithToolTip";
import { useSelector } from "react-redux";
import { ROUTES } from "../../util/navigation";
import { RootState } from "../../redux/store";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const ConfigErrorIndicator = () => {
  const configError = useSelector(
    (store: RootState) => store.state.configError,
  );

  const navigate = useNavigate();
  const { pathname } = useLocation();

  function onClickError() {
    navigate(pathname === ROUTES.CONFIG_ERROR ? "/" : ROUTES.CONFIG_ERROR);
  }

  if (!configError) {
    return null;
  }

  // TODO: add a tooltip
  return (
    <HeaderButtonWithToolTip
      tooltipPlacement="top-end"
      text="Config error"
      onClick={onClickError}
    >
      <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
    </HeaderButtonWithToolTip>
  );
};

export default ConfigErrorIndicator;

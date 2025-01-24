import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import PageHeader from "../../components/PageHeader";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { SharedConfigSchema } from "core/config/sharedConfig";
import { Switch } from "@headlessui/react";
import { updateConfig } from "../../redux/slices/configSlice";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);

  function handleUpdateSharedConfig(sharedConfig: Partial<SharedConfigSchema>) {
    ideMessenger.post("config/updateSharedConfig", sharedConfig);

    // TODO: Optimistic update in redux
    // dispatch(updateConfig({
    //   ...config,
    //   ...(sharedConfig.)
    // }))
  }

  return (
    <div className="overflow-y-scroll">
      <PageHeader onClick={() => navigate("/")} title="Chat" />

      <div className="flex flex-col gap-2 overflow-y-scroll px-3">
        <Switch checked={true}>Hello</Switch>
      </div>
    </div>
  );
}

export default ConfigPage;

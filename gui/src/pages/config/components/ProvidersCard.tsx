import type {
  ProviderSetupConnection,
  ProviderSetupInfo,
} from "core/config/providerSetup";
import { useContext, useEffect, useState } from "react";
import { useProviderSetupDialog } from "../../../components/ProviderSetup/useProviderSetupDialog";
import { Button, Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import { providerLabel } from "../../../util/missingSecrets";

function describe(c: ProviderSetupConnection): string {
  const where =
    c.connection.apiBase ?? c.connection.region ?? c.connection.profile;
  const count = `${c.models.length} model${c.models.length === 1 ? "" : "s"}`;
  return where ? `${where} - ${count}` : count;
}

/**
 * One row per provider connection in config.yaml, with a way back into the
 * setup flow to change its models or key.
 */
export function ProvidersCard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { openSetup } = useProviderSetupDialog();
  // The config object changes whenever a save reloads it.
  const config = useAppSelector((state) => state.config.config);
  const [info, setInfo] = useState<ProviderSetupInfo>();

  useEffect(() => {
    let cancelled = false;
    void ideMessenger
      .request("config/getProviderSetup", undefined)
      .then((res) => {
        if (!cancelled && res.status === "success") setInfo(res.content);
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger, config]);

  return (
    <Card>
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <div className="text-sm font-medium">Providers</div>
          <div className="text-xs text-description-muted">
            Connect a provider and choose which of its models to use
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="my-0"
          onClick={() => openSetup()}
          data-testid="add-provider"
        >
          Add provider
        </Button>
      </div>
      {info && info.editable === false && (
        <div className="px-3 pb-2 text-xs text-description-muted">
          Models are saved in config.yaml, and this profile has none.
        </div>
      )}
      {info?.connections.map((c) => {
        const id = `${c.provider}|${JSON.stringify(c.connection)}`;
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
            data-testid={`provider-row-${c.provider}`}
          >
            <div className="min-w-0">
              <span className="font-medium">{providerLabel(c.provider)}</span>{" "}
              <span className="truncate text-description-muted">
                {describe(c)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="my-0"
              onClick={() =>
                openSetup({
                  initialProvider: c.provider,
                  initialConnection: c.connection,
                })
              }
            >
              Edit
            </Button>
          </div>
        );
      })}
    </Card>
  );
}

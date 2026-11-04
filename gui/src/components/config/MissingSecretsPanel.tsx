import {
  ClipboardIcon,
  DocumentTextIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";

import { IdeMessengerContext } from "../../context/IdeMessenger";
import { MissingSecret, providerLabel } from "../../util/missingSecrets";
import { useProviderSetupDialog } from "../ProviderSetup/useProviderSetupDialog";
import { Button } from "../ui";

interface MissingSecretsPanelProps {
  missing: MissingSecret[];
  /** Called after an action runs, so the host popover can close. */
  onDone?: () => void;
}

/**
 * What to do about secrets that have no value on this machine. Shown in a
 * popover from the toolbar warning, the model gear and the Models tab.
 */
export function MissingSecretsPanel({
  missing,
  onDone,
}: MissingSecretsPanelProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { openEnterKey } = useProviderSetupDialog();

  const open = (secretName: string, target: "env" | "configLine") => {
    ideMessenger.post("config/openSecretLocation", { secretName, target });
    onDone?.();
  };

  const enterKey = (secret: MissingSecret) => {
    openEnterKey({
      secretName: secret.secretName,
      provider: secret.providers[0],
    });
    onDone?.();
  };

  const copy = (secretName: string) => {
    void navigator.clipboard.writeText(secretName);
    onDone?.();
  };

  return (
    <div
      className="flex w-72 max-w-full flex-col gap-3 p-2 text-xs"
      data-testid="missing-secrets-panel"
    >
      <div className="flex items-center gap-1.5 font-medium">
        <KeyIcon className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span>
          {missing.length === 1
            ? "A key is not set on this machine"
            : `${missing.length} keys are not set on this machine`}
        </span>
      </div>

      {missing.map((secret) => (
        <div
          key={secret.secretName}
          className="flex flex-col gap-1.5"
          data-testid={`missing-secret-${secret.secretName}`}
        >
          <div className="text-description">
            <code className="text-foreground">{secret.secretName}</code>
            {" - "}
            {secret.providers.map(providerLabel).join(", ")}
            {secret.modelNames.length > 0 && (
              <span className="text-description-muted">
                {" "}
                ({secret.modelNames.join(", ")})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="primary"
              size="sm"
              className="my-0 flex items-center gap-1"
              onClick={() => enterKey(secret)}
              data-testid={`enter-key-${secret.secretName}`}
            >
              <KeyIcon className="h-3 w-3" />
              Enter key
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="my-0 flex items-center gap-1"
              onClick={() => open(secret.secretName, "env")}
              data-testid={`open-env-${secret.secretName}`}
            >
              <DocumentTextIcon className="h-3 w-3" />
              Open .env
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="my-0"
              onClick={() => open(secret.secretName, "configLine")}
              data-testid={`open-config-line-${secret.secretName}`}
            >
              Open config line
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="my-0 flex items-center gap-1"
              onClick={() => copy(secret.secretName)}
              data-testid={`copy-name-${secret.secretName}`}
            >
              <ClipboardIcon className="h-3 w-3" />
              Copy name
            </Button>
          </div>
        </div>
      ))}

      <div className="text-description-muted">
        Add <code>NAME=value</code> to <code>~/.continue/.env</code>, or set it
        as an environment variable, then the config reloads on save.
      </div>
    </div>
  );
}

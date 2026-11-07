import { SelectionDiff } from "./providerSetupUtils";

interface ReviewStepProps {
  providerTitle: string;
  diff: SelectionDiff;
  /** One sentence about where the key goes (see describeKeyPlan). */
  keyPlan: string;
  /** Removals must be confirmed before saving. */
  confirmedRemoval: boolean;
  onConfirmRemoval: (confirmed: boolean) => void;
  error?: string;
  warning?: string;
  /** Set when the endpoint, region or profile of the connection is edited. */
  connectionChange?: { from: string; to: string; modelCount: number };
  /**
   * Set when the models are saved through a provider account: the account
   * (providers.yaml) and the model catalog (models.yaml) are written too.
   * The name, when it is known before saving.
   */
  account?: { name?: string };
}

/** The last step: what will change in config.yaml. Nothing is saved before. */
export function ReviewStep({
  providerTitle,
  diff,
  keyPlan,
  confirmedRemoval,
  onConfirmRemoval,
  error,
  warning,
  connectionChange,
  account,
}: ReviewStepProps) {
  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="review-step">
      {connectionChange && (
        <div data-testid="review-connection-change">
          <div className="font-medium">Change endpoint</div>
          <div>
            {connectionChange.from} becomes {connectionChange.to}. The{" "}
            {connectionChange.modelCount} existing model
            {connectionChange.modelCount === 1 ? "" : "s"} on it keep their
            names and settings.
          </div>
        </div>
      )}
      <div>
        <div className="font-medium">Add to config.yaml</div>
        {account && (
          <div className="text-description-muted" data-testid="review-account">
            {account.name
              ? `Through the account "${account.name}"`
              : "Through a new account"}{" "}
            in providers.yaml; each model is defined once in models.yaml, so
            other configs can use it too.
          </div>
        )}
        {diff.add.length === 0 ? (
          <div className="text-description-muted">No new models</div>
        ) : (
          <ul className="m-0 pl-4" data-testid="review-additions">
            {diff.add.map((row) => (
              <li key={row.model}>{row.title}</li>
            ))}
          </ul>
        )}
      </div>

      {diff.remove.length > 0 && (
        <div>
          <div className="font-medium text-warning">
            Remove from config.yaml
          </div>
          <ul className="m-0 pl-4" data-testid="review-removals">
            {diff.remove.map((m) => (
              <li key={m.model}>{m.name}</li>
            ))}
          </ul>
          <label className="mt-1.5 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmedRemoval}
              onChange={(e) => onConfirmRemoval(e.target.checked)}
              aria-label="Confirm removal"
            />
            <span>
              Remove {diff.remove.length} {providerTitle} model
              {diff.remove.length === 1 ? "" : "s"}. They are also taken out of
              the Chat, Plan and Agent lists.
            </span>
          </label>
        </div>
      )}

      {diff.keep.length > 0 && (
        <div className="text-description-muted">
          {diff.keep.length} existing model{diff.keep.length === 1 ? "" : "s"}{" "}
          stay as they are.
        </div>
      )}

      <div data-testid="review-key-plan">{keyPlan}</div>

      {warning && <div className="text-warning">{warning}</div>}
      {error && (
        <div className="text-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

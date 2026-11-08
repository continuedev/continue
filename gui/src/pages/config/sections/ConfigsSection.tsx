import {
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { useContext, useState } from "react";
import { Input } from "../../../components";
import { AssistantIcon } from "../../../components/AssistantAndOrgListbox/AssistantIcon";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button, Card, Divider, EmptyState } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { FormSelect } from "../../../forms/FormSelect";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setSelectedProfile } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { PlaintextKeysNotice } from "../components/PlaintextKeysNotice";

/** The main config (~/.continuous/config.yaml) cannot be deleted. */
const MAIN_PROFILE_ID = "local";

type Draft =
  | {
      kind: "create";
      name: string;
      location: "global" | "workspace";
      copyFrom: string;
    }
  | { kind: "rename"; profileId: string; name: string };

export function ConfigsSection() {
  const { profiles, selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const configError = useAppSelector((state) => state.config.configError);
  const [draft, setDraft] = useState<Draft>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function select(profile: ProfileDescription) {
    if (profile.id === selectedProfile?.id) return;
    dispatch(setSelectedProfile(profile.id));
    ideMessenger.post("didChangeSelectedProfile", { id: profile.id });
  }

  function startCreate(copyFrom = "") {
    setError(undefined);
    const source = profiles?.find((p) => p.id === copyFrom);
    setDraft({
      kind: "create",
      name: source ? `${source.title} copy` : "",
      location: "global",
      copyFrom,
    });
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(undefined);
    try {
      const res =
        draft.kind === "create"
          ? await ideMessenger.request("config/createProfile", {
              name: draft.name,
              location: draft.location,
              ...(draft.copyFrom ? { copyFrom: draft.copyFrom } : {}),
            })
          : await ideMessenger.request("config/renameProfile", {
              profileId: draft.profileId,
              name: draft.name,
            });
      const content = res.status === "success" ? res.content : undefined;
      if (!content || !content.ok) {
        setError(content && !content.ok ? content.error : "Could not save");
        return;
      }
      if (content.profileId) dispatch(setSelectedProfile(content.profileId));
      setDraft(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function remove(profileId: string) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("config/deleteProfile", {
        profileId,
      });
      const content = res.status === "success" ? res.content : undefined;
      if (!content || !content.ok) {
        setError(content && !content.ok ? content.error : "Could not delete");
      }
      setConfirmDelete(undefined);
    } finally {
      setBusy(false);
    }
  }

  const draftForm = draft && (
    <div className="flex flex-col gap-2 py-2" data-testid="config-draft">
      <label className="text-xs font-medium" htmlFor="config-name">
        {draft.kind === "create" ? "New config name" : "Rename to"}
      </label>
      <Input
        id="config-name"
        autoFocus
        value={draft.name}
        placeholder="e.g. Local or Cloud"
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") setDraft(undefined);
        }}
      />
      {draft.kind === "create" && (
        <>
          <label className="text-xs font-medium" htmlFor="config-location">
            Save in
          </label>
          <FormSelect
            id="config-location"
            value={draft.location}
            onChange={(e) =>
              setDraft({
                ...draft,
                location: e.target.value as "global" | "workspace",
              })
            }
          >
            <option value="global">
              ~/.continuous/configs (every workspace)
            </option>
            <option value="workspace">
              This workspace's .continuous/configs
            </option>
          </FormSelect>
          <label className="text-xs font-medium" htmlFor="config-copy-from">
            Start from
          </label>
          <FormSelect
            id="config-copy-from"
            value={draft.copyFrom}
            onChange={(e) => setDraft({ ...draft, copyFrom: e.target.value })}
          >
            <option value="">An empty config</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                A copy of {p.title}
              </option>
            ))}
          </FormSelect>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy || !draft.name.trim()}
          onClick={() => void submit()}
        >
          {draft.kind === "create" ? "Create and switch" : "Rename"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <ConfigHeader
        title="Configs"
        subtext="Each config picks models (from your provider accounts or its own) and assigns them to tasks. Click a config to switch to it."
        onAddClick={() => startCreate()}
        addButtonTooltip="New config"
      />

      <PlaintextKeysNotice />

      {error && (
        <div className="mb-2 text-xs text-error" role="alert">
          {error}
        </div>
      )}

      <Card>
        {draft?.kind === "create" && (
          <>
            {draftForm}
            <Divider />
          </>
        )}
        {profiles && profiles.length > 0 ? (
          profiles.map((profile, index) => {
            const isSelected = profile.id === selectedProfile?.id;
            const errors = isSelected ? configError : profile.errors;
            const hasFatalErrors =
              errors && errors.some((error) => error.fatal);
            const hasErrors = errors && errors.length > 0;
            const isMain = profile.id === MAIN_PROFILE_ID;
            const isYaml = /\.ya?ml$/i.test(profile.uri);
            return (
              <div key={profile.id} data-testid="config-row">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 border-none bg-transparent p-0 text-left text-inherit"
                    aria-pressed={isSelected}
                    title={
                      isSelected ? "Selected config" : "Switch to this config"
                    }
                    onClick={() => select(profile)}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                      {isSelected ? (
                        <CheckCircleIcon className="h-4 w-4 text-success" />
                      ) : (
                        <AssistantIcon assistant={profile} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <h3
                        className={`my-2 text-sm font-medium ${
                          hasFatalErrors
                            ? "text-error"
                            : hasErrors
                              ? "text-yellow-500"
                              : ""
                        }`}
                      >
                        {profile.title}
                        {isSelected && (
                          <span className="ml-2 text-xs font-normal text-description-muted">
                            selected
                          </span>
                        )}
                        {isMain && (
                          <span className="ml-2 text-xs font-normal text-description-muted">
                            main
                          </span>
                        )}
                      </h3>
                      {errors && errors.length > 0 && (
                        <div className="space-y-1 overflow-hidden">
                          {errors.map((error, errorIndex) => (
                            <div
                              onClick={(e) => {
                                if (error.uri) {
                                  e.stopPropagation();
                                  ideMessenger.post("openFile", {
                                    path: error.uri,
                                  });
                                }
                              }}
                              key={errorIndex}
                              className={`${
                                error.fatal
                                  ? "bg-error/10 text-error"
                                  : "bg-yellow-500/10 text-yellow-500"
                              } rounded-sm border border-solid border-transparent px-2 py-1 text-xs break-all ${error.uri ? "cursor-pointer " + (error.fatal ? "hover:border-error" : "hover:border-yellow-500") : ""}`}
                            >
                              {error.message.split("\n")[0]}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isYaml && (
                      <ToolTip content="Rename">
                        <Button
                          aria-label={`Rename ${profile.title}`}
                          onClick={() => {
                            setError(undefined);
                            setDraft({
                              kind: "rename",
                              profileId: profile.id,
                              name: profile.title,
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          className="my-0 h-6 w-6 p-0 text-description-muted hover:enabled:text-foreground"
                        >
                          <PencilIcon className="h-4 w-4 shrink-0" />
                        </Button>
                      </ToolTip>
                    )}
                    {isYaml && (
                      <ToolTip content="Duplicate">
                        <Button
                          aria-label={`Duplicate ${profile.title}`}
                          onClick={() => startCreate(profile.id)}
                          variant="ghost"
                          size="sm"
                          className="my-0 h-6 w-6 p-0 text-description-muted hover:enabled:text-foreground"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4 shrink-0" />
                        </Button>
                      </ToolTip>
                    )}
                    <ToolTip content="Edit the YAML in the editor">
                      <Button
                        aria-label={`Edit ${profile.title} in the editor`}
                        onClick={() =>
                          ideMessenger.post("config/openProfile", {
                            profileId: profile.id,
                          })
                        }
                        variant="ghost"
                        size="sm"
                        className="my-0 h-6 w-6 p-0 text-description-muted hover:enabled:text-foreground"
                      >
                        <PencilSquareIcon className="h-4 w-4 shrink-0" />
                      </Button>
                    </ToolTip>
                    {!isMain && (
                      <ToolTip content="Delete">
                        <Button
                          aria-label={`Delete ${profile.title}`}
                          onClick={() => setConfirmDelete(profile.id)}
                          variant="ghost"
                          size="sm"
                          className="my-0 h-6 w-6 p-0 text-description-muted hover:enabled:text-error"
                        >
                          <TrashIcon className="h-4 w-4 shrink-0" />
                        </Button>
                      </ToolTip>
                    )}
                  </div>
                </div>
                {draft?.kind === "rename" &&
                  draft.profileId === profile.id &&
                  draftForm}
                {confirmDelete === profile.id && (
                  <div className="flex items-center justify-between gap-2 pb-2 text-xs">
                    <span>
                      Delete {profile.title}? Its file is removed; your provider
                      accounts and keys are kept.
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(undefined)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(profile.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
                {index < profiles.length - 1 && <Divider />}
              </div>
            );
          })
        ) : (
          <EmptyState message="No configs yet. Click the + button to create one." />
        )}
      </Card>
    </>
  );
}

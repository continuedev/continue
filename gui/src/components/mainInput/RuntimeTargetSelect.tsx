import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { useContext, useMemo } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  setSelectedOrgId,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
import { cn } from "../../util/cn";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

type RuntimeSurface = "workspace" | "local" | "cloud";

interface RuntimeTarget {
  organizationId: string;
  organizationName: string;
  profile: ProfileDescription;
}

interface RuntimeOption {
  surface: RuntimeSurface;
  label: string;
  description: string;
  colorClassName: string;
  target?: RuntimeTarget;
  disabled?: boolean;
}

function getRuntimeSurface(profile: ProfileDescription | null): RuntimeSurface {
  if (!profile) {
    return "workspace";
  }

  return profile.profileType === "local" ? "local" : "cloud";
}

function getRuntimeLabel(surface: RuntimeSurface): string {
  switch (surface) {
    case "local":
      return "Local";
    case "cloud":
      return "Cloud";
    default:
      return "Workspace";
  }
}

function getRuntimeColorClassName(surface: RuntimeSurface): string {
  switch (surface) {
    case "local":
      return "bg-emerald-400";
    case "cloud":
      return "bg-sky-400";
    default:
      return "bg-amber-400";
  }
}

function getRuntimeDescription(surface: RuntimeSurface): string {
  switch (surface) {
    case "local":
      return "Runs against your local agent profile.";
    case "cloud":
      return "Runs against your cloud-backed profile.";
    default:
      return "Runs against the current workspace profile.";
  }
}

export function RuntimeTargetSelect() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { organizations, selectedProfile } = useAuth();
  const selectedOrgId = useAppSelector(
    (state) => state.profiles.selectedOrganizationId,
  );

  const currentSurface = getRuntimeSurface(selectedProfile);

  const runtimeTargets = useMemo(() => {
    const localTargets: RuntimeTarget[] = [];
    const cloudTargets: RuntimeTarget[] = [];

    for (const organization of organizations) {
      for (const profile of organization.profiles) {
        const target = {
          organizationId: organization.id,
          organizationName: organization.name,
          profile,
        };

        if (profile.profileType === "local") {
          localTargets.push(target);
        } else {
          cloudTargets.push(target);
        }
      }
    }

    return {
      local:
        localTargets.find(
          (target) => target.profile.id === selectedProfile?.id,
        ) ?? localTargets[0],
      cloud:
        cloudTargets.find(
          (target) => target.profile.id === selectedProfile?.id,
        ) ?? cloudTargets[0],
    };
  }, [organizations, selectedProfile?.id]);

  const currentRuntime = useMemo(() => {
    const activeTarget =
      currentSurface === "local"
        ? runtimeTargets.local
        : currentSurface === "cloud"
          ? runtimeTargets.cloud
          : undefined;

    return {
      surface: currentSurface,
      label: getRuntimeLabel(currentSurface),
      description: activeTarget
        ? `${getRuntimeDescription(currentSurface)} ${activeTarget.profile.title}`
        : getRuntimeDescription(currentSurface),
      colorClassName: getRuntimeColorClassName(currentSurface),
    };
  }, [currentSurface, runtimeTargets.cloud, runtimeTargets.local]);

  const runtimeOptions = useMemo<RuntimeOption[]>(() => {
    const options: RuntimeOption[] = [];

    if (currentSurface === "workspace") {
      options.push({
        surface: "workspace",
        label: "Workspace",
        description:
          "Current workspace default. Select a concrete runtime below.",
        colorClassName: getRuntimeColorClassName("workspace"),
        disabled: true,
      });
    }

    options.push({
      surface: "local",
      label: "Local",
      description: runtimeTargets.local
        ? `Use ${runtimeTargets.local.profile.title}`
        : "No local runtime is available in the current profiles.",
      colorClassName: getRuntimeColorClassName("local"),
      target: runtimeTargets.local,
      disabled: !runtimeTargets.local,
    });

    options.push({
      surface: "cloud",
      label: "Cloud",
      description: runtimeTargets.cloud
        ? `Use ${runtimeTargets.cloud.profile.title} from ${runtimeTargets.cloud.organizationName}`
        : "No cloud runtime is available in the current profiles.",
      colorClassName: getRuntimeColorClassName("cloud"),
      target: runtimeTargets.cloud,
      disabled: !runtimeTargets.cloud,
    });

    return options;
  }, [currentSurface, runtimeTargets.cloud, runtimeTargets.local]);

  const handleRuntimeChange = (surface: RuntimeSurface) => {
    const nextOption = runtimeOptions.find(
      (option) => option.surface === surface,
    );

    if (!nextOption?.target) {
      return;
    }

    const { organizationId, profile } = nextOption.target;

    if (organizationId !== selectedOrgId) {
      dispatch(setSelectedOrgId(organizationId));
      ideMessenger.post("didChangeSelectedOrg", {
        id: organizationId,
      });
    }

    dispatch(setSelectedProfile(profile.id));
    ideMessenger.post("didChangeSelectedProfile", {
      id: profile.id,
    });
  };

  return (
    <Listbox value={currentSurface} onChange={handleRuntimeChange}>
      <div className="relative">
        <ListboxButton
          data-testid="runtime-target-pill"
          aria-label="Select runtime target"
          className="text-description h-7 gap-1 rounded-xl border-transparent px-2 text-[11px] font-medium"
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              currentRuntime.colorClassName,
            )}
          />
          <span>{currentRuntime.label}</span>
          <ChevronDownIcon className="text-description-muted h-3 w-3" />
        </ListboxButton>

        <ListboxOptions className="min-w-[240px] p-1">
          {runtimeOptions.map((option) => {
            const isSelected = option.surface === currentSurface;

            return (
              <ListboxOption
                key={option.surface}
                value={option.surface}
                disabled={option.disabled}
                data-testid={`runtime-target-option-${option.surface}`}
                className={cn(
                  "rounded-lg",
                  isSelected && !option.disabled
                    ? "bg-list-active text-list-active-foreground"
                    : "",
                )}
              >
                <div className="flex w-full items-start gap-3 py-0.5">
                  <span
                    className={cn(
                      "mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      option.colorClassName,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("text-sm", isSelected && "font-semibold")}
                      >
                        {option.label}
                      </span>
                      {isSelected && !option.disabled && (
                        <span className="rounded-full border border-solid border-current px-1.5 py-0.5 text-[10px] font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-description-muted text-xs">
                      {option.description}
                    </div>
                  </div>
                </div>
              </ListboxOption>
            );
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

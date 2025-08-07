import { parseConfigYaml } from "@continuedev/config-yaml";
import {
  BookmarkIcon as BookmarkOutline,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { SlashCommandDescWithSource } from "core";
import { useContext, useMemo } from "react";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useBookmarkedSlashCommands } from "../../../../hooks/useBookmarkedSlashCommands";
import { useAppSelector } from "../../../../redux/hooks";
import { fontSize } from "../../../../util";
import { useMainEditor } from "../../TipTapEditor";
import { useLump } from "../LumpContext";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

interface PromptCommandWithSlug extends SlashCommandDescWithSource {
  slug?: string;
}

interface PromptRowProps {
  prompt: PromptCommandWithSlug;
  isBookmarked: boolean;
  setIsBookmarked: (isBookmarked: boolean) => void;
  onEdit?: () => void;
}

/**
 * Displays a single prompt row with bookmark and edit controls
 */
function PromptRow({
  prompt,
  isBookmarked,
  setIsBookmarked,
  onEdit,
}: PromptRowProps) {
  const { mainEditor } = useMainEditor();
  const { hideLump } = useLump();

  const handlePromptClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    mainEditor?.commands.insertPrompt({
      title: prompt.name,
      description: prompt.description,
      content: prompt.prompt,
    });
    hideLump();
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    }
  };

  const canEdit =
    prompt.promptFile && !prompt.promptFile.startsWith("builtin:");

  return (
    <div
      className="hover:bg-list-active hover:text-list-active-foreground flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:cursor-pointer"
      onClick={handlePromptClick}
      style={{
        fontSize: fontSize(-3),
      }}
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-vscForeground shrink-0 font-medium">
          {prompt.name}
        </span>
        <span className="line-clamp-2 text-[11px] text-gray-400">
          {prompt.description}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <PencilIcon
          className={`h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125 ${!canEdit ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
          onClick={canEdit ? handleEditClick : undefined}
          aria-disabled={!canEdit}
        />
        <div
          onClick={handleBookmarkClick}
          className="cursor-pointer pt-0.5 text-gray-400 hover:brightness-125"
        >
          {isBookmarked ? (
            <BookmarkSolid className="h-3 w-3" />
          ) : (
            <BookmarkOutline className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Section that displays all available prompts with bookmarking functionality
 */
export function PromptsSection() {
  const { selectedProfile } = useAuth();
  const { isCommandBookmarked, toggleBookmark } = useBookmarkedSlashCommands();
  const ideMessenger = useContext(IdeMessengerContext);

  const slashCommands = useAppSelector(
    (state) => state.config.config.slashCommands ?? [],
  );

  const handleEdit = (prompt: PromptCommandWithSlug) => {
    if (prompt.promptFile) {
      ideMessenger.post("openFile", {
        path: prompt.promptFile,
      });
    } else if (prompt.slug) {
      void ideMessenger.request("controlPlane/openUrl", {
        path: `${prompt.slug}/new-version`,
        orgSlug: undefined,
      });
    } else {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
        element: { sourceFile: (prompt as any).sourceFile },
      });
    }
  };

  const sortedCommands = useMemo(() => {
    const promptsWithSlug: PromptCommandWithSlug[] =
      structuredClone(slashCommands);
    // get the slugs from rawYaml
    if (selectedProfile?.rawYaml) {
      const parsed = parseConfigYaml(selectedProfile.rawYaml);
      const parsedPrompts = parsed.prompts ?? [];

      let index = 0;
      for (const commandWithSlug of promptsWithSlug) {
        // skip for local prompt files
        if (commandWithSlug.promptFile) continue;

        const yamlPrompt = parsedPrompts[index];
        if (yamlPrompt) {
          if ("uses" in yamlPrompt) {
            commandWithSlug.slug = yamlPrompt.uses;
          } else {
            commandWithSlug.slug = `${selectedProfile?.fullSlug.ownerSlug}/${selectedProfile?.fullSlug.packageSlug}`;
          }
        }
        index = index + 1;
      }
    }
    return promptsWithSlug.sort((a, b) => {
      const aBookmarked = isCommandBookmarked(a.name);
      const bBookmarked = isCommandBookmarked(b.name);
      if (aBookmarked && !bBookmarked) return -1;
      if (!aBookmarked && bBookmarked) return 1;
      return 0;
    });
  }, [slashCommands, isCommandBookmarked, selectedProfile]);

  return (
    <div className="flex flex-col">
      {sortedCommands.map((prompt) => (
        <PromptRow
          key={prompt.name}
          prompt={prompt}
          isBookmarked={isCommandBookmarked(prompt.name)}
          setIsBookmarked={() => toggleBookmark(prompt)}
          onEdit={() => handleEdit(prompt)}
        />
      ))}
      <ExploreBlocksButton blockType="prompts" />
    </div>
  );
}

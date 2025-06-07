import { parseConfigYaml } from "@continuedev/config-yaml";
import {
  BookmarkIcon as BookmarkOutline,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { SlashCommandDescription } from "core";
import { useContext, useMemo } from "react";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useBookmarkedSlashCommands } from "../../../../hooks/useBookmarkedSlashCommands";
import { useAppSelector } from "../../../../redux/hooks";
import { fontSize } from "../../../../util";
import { useMainEditor } from "../../TipTapEditor";
import { useLump } from "../LumpContext";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

type PromptWithSlug = SlashCommandDescription & { slug?: string };

interface PromptRowProps {
  prompt: PromptWithSlug;
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
    mainEditor?.commands.insertPrompt(prompt);
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
          className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
          onClick={handleEditClick}
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

  const handleEdit = (prompt: PromptWithSlug) => {
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
      });
    }
  };

  const sortedCommands = useMemo(() => {
    const promptsWithSlug: PromptWithSlug[] = structuredClone(slashCommands);
    // get the slugs from rawYaml
    if (selectedProfile?.rawYaml) {
      const parsed = parseConfigYaml(selectedProfile.rawYaml);
      const parsedPrompts = parsed.prompts ?? [];

      let index = 0;
      for (const prompt of promptsWithSlug) {
        // skip for local prompt files
        if (prompt.promptFile) continue;

        const yamlPrompt = parsedPrompts[index];
        if (yamlPrompt) {
          if ("uses" in yamlPrompt) {
            prompt.slug = yamlPrompt.uses;
          } else {
            prompt.slug = `${selectedProfile?.fullSlug.ownerSlug}/${selectedProfile?.fullSlug.packageSlug}`;
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

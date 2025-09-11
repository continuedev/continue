import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { getUriPathBasename } from "core/util/uri";
import { ComponentType, useContext, useMemo } from "react";
import {
  IdeMessengerContext,
  IIdeMessenger,
} from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import { selectIsGatheringContext } from "../../../redux/slices/sessionSlice";
import { AnimatedEllipsis } from "../../AnimatedEllipsis";
import FileIcon from "../../FileIcon";
import SafeImg from "../../SafeImg";
import ToggleDiv from "../../ToggleDiv";
import { getIconFromDropdownItem } from "../AtMentionDropdown";
import { NAMED_ICONS } from "../icons";

interface ContextItemsPeekProps {
  contextItems?: ContextItemWithId[];
  isCurrentContextPeek: boolean;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
  title?: JSX.Element | string;
}

interface ContextItemsPeekItemProps {
  contextItem: ContextItemWithId;
}

export function openContextItem(
  contextItem: ContextItemWithId,
  ideMessenger: IIdeMessenger,
) {
  const { uri, name, content } = contextItem;

  if (uri && uri?.type === "file") {
    const isRangeInFile = name.includes(" (") && name.endsWith(")");

    if (isRangeInFile) {
      const rif = ctxItemToRifWithContents(contextItem, true);
      void ideMessenger.ide.showLines(
        rif.filepath,
        rif.range.start.line,
        rif.range.end.line,
      );
    } else {
      void ideMessenger.ide.openFile(uri.value);
    }
  } else {
    void ideMessenger.ide.showVirtualFile(name, content);
  }
}

export function ContextItemsPeekItem({
  contextItem,
}: ContextItemsPeekItemProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const isUrl = contextItem.uri?.type === "url";

  function getContextItemIcon() {
    const dimensions = "18px";

    if (contextItem.icon) {
      const NamedIcon = contextItem.icon
        ? NAMED_ICONS[contextItem.icon]
        : undefined;
      return (
        <SafeImg
          className="mr-2 flex-shrink-0 rounded-md p-1"
          src={contextItem.icon}
          height={dimensions}
          width={dimensions}
          fallback={
            NamedIcon ? (
              <div
                className="mr-2 flex-shrink-0"
                style={{
                  height: dimensions,
                  width: dimensions,
                }}
              >
                <NamedIcon />
              </div>
            ) : null
          }
        />
      );
    }

    // Heuristic to check if it's a file
    const shouldShowFileIcon =
      contextItem.content.includes("```") || contextItem.uri?.type === "file";

    if (shouldShowFileIcon) {
      return (
        <div className="mr-2 flex-shrink-0">
          <FileIcon
            filename={
              contextItem.description.split(" ").shift()?.split("#").shift() ||
              ""
            }
            height={dimensions}
            width={dimensions}
          />
        </div>
      );
    }

    const ProviderIcon = getIconFromDropdownItem(
      contextItem.id.providerTitle,
      "contextProvider",
    );

    return (
      <ProviderIcon
        className="mr-2 flex-shrink-0"
        height={dimensions}
        width={dimensions}
      />
    );
  }

  return (
    <div
      onClick={() => openContextItem(contextItem, ideMessenger)}
      className="mr-2 flex cursor-pointer flex-row items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-xs hover:bg-white/10"
      data-testid="context-items-peek-item"
    >
      {getContextItemIcon()}
      <span className={`line-clamp-1 max-w-[130px] flex-shrink-0`}>
        {contextItem.name}
      </span>
      <div
        className={`text-description-muted group flex flex-row items-center gap-1.5 pr-1.5 text-xs ${isUrl ? "hover:underline" : ""}`}
        onClick={
          isUrl
            ? (e) => {
                if (contextItem.uri?.value) {
                  e.stopPropagation();
                  ideMessenger.post("openUrl", contextItem.uri.value);
                } else {
                  console.error("Couldn't open url", contextItem.uri);
                }
              }
            : undefined
        }
      >
        <span className={`line-clamp-1 flex-1 break-all`}>
          {contextItem.uri?.type === "file"
            ? getUriPathBasename(contextItem.description)
            : contextItem.description}
        </span>
        {isUrl && (
          <ArrowTopRightOnSquareIcon className="text-description-muted h-3 w-3 flex-shrink-0 opacity-80 group-hover:opacity-100" />
        )}
      </div>
    </div>
  );
}

export function ContextItemsPeek({
  contextItems,
  isCurrentContextPeek,
  icon,
  title,
}: ContextItemsPeekProps) {
  const ctxItems = useMemo(() => {
    return contextItems?.filter((ctxItem) => !ctxItem.hidden) ?? [];
  }, [contextItems]);

  const isGatheringContext = useAppSelector(selectIsGatheringContext);

  const indicateIsGathering = isCurrentContextPeek && isGatheringContext;

  if ((!ctxItems || ctxItems.length === 0) && !indicateIsGathering) {
    return null;
  }

  return (
    <ToggleDiv
      icon={icon}
      title={
        title ??
        (isGatheringContext ? (
          <>
            Gathering context
            <AnimatedEllipsis />
          </>
        ) : (
          `${ctxItems.length} context ${ctxItems.length > 1 ? "items" : "item"}`
        ))
      }
    >
      {ctxItems.length ? (
        ctxItems.map((contextItem, idx) => (
          <ContextItemsPeekItem key={idx} contextItem={contextItem} />
        ))
      ) : (
        <div className="text-description-muted pl-2 text-xs italic">
          No results
        </div>
      )}
    </ToggleDiv>
  );
}

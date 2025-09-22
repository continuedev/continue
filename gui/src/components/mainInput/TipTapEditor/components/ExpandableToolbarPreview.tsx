import {
  ChevronDownIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { EyeIcon } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBadgeBackground,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "../../..";
import { useAppSelector } from "../../../../redux/hooks";
import { getFontSize } from "../../../../util";
import HeaderButtonWithToolTip from "../../../gui/HeaderButtonWithToolTip";

const MAX_PREVIEW_HEIGHT = 100;
const MAX_EXPANED_PREVIEW_HEIGHT = MAX_PREVIEW_HEIGHT * 3;

const PreviewDiv = styled.div<{
  borderColor?: string;
}>`
  background-color: ${vscEditorBackground};
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${(props) => props.borderColor || lightGray};
  margin-top: 4px;
  margin-bottom: 4px;
  overflow: hidden;
  position: relative;

  & div {
    background-color: ${vscEditorBackground};
  }
`;

const ContentContainer = styled.div<{ expanded: boolean }>`
  position: relative;
  max-height: ${(props) =>
    props.expanded
      ? `${MAX_EXPANED_PREVIEW_HEIGHT}px`
      : `${MAX_PREVIEW_HEIGHT}px`};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ScrollableContent = styled.div<{ shouldShowChevron: boolean }>`
  overflow-y: auto;
  padding-bottom: ${(props) => (props.shouldShowChevron ? "24px" : "0px")};
`;

const ChevronContainer = styled.div`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  background: ${vscEditorBackground};
  padding: 4px 0;
  z-index: 10;
`;

/**
 * Props for the ExpandableToolbarPreview component
 */
interface ExpandableToolbarPreviewProps {
  /** Title to display in the header */
  title: string;
  /** Optional icon to display next to the title */
  icon?: React.ReactNode;
  /** ID of the input this preview is associated with (for toolbar hiding logic) */
  inputId?: string;
  /** ID of the item being displayed (for toolbar hiding logic) */
  itemId?: string;
  /** Whether the preview is initially hidden (overridden if inputId and itemId are provided) */
  initiallyHidden?: boolean;
  /** Callback when the delete button is clicked */
  onDelete?: () => void;
  /** Callback when the title is clicked */
  onTitleClick?: (e: React.MouseEvent) => void;
  /** Border color of the preview */
  borderColor?: string;
  /* Whether the preview is selected */
  isSelected?: boolean;
  /** Content to display in the preview */
  children: React.ReactNode;
}

/**
 * A generalized expandable preview component for displaying content with a header and expandable body
 */
export function ExpandableToolbarPreview(props: ExpandableToolbarPreviewProps) {
  // Get toolbar visibility state from Redux if inputId and itemId are provided
  const newestCodeblockForInputId = useAppSelector((store) =>
    props.inputId
      ? store.session.newestToolbarPreviewForInput[props.inputId]
      : undefined,
  );

  const calculatedInitiallyHidden = useMemo(() => {
    // If initiallyHidden is explicitly set to false, always start visible
    if (props.initiallyHidden === false) {
      return false;
    }

    // Otherwise, use the inputId/itemId logic
    if (props.inputId && props.itemId) {
      return newestCodeblockForInputId !== props.itemId;
    }
    return props.initiallyHidden ?? false;
  }, [
    newestCodeblockForInputId,
    props.inputId,
    props.itemId,
    props.initiallyHidden,
  ]);

  const [hidden, setHidden] = useState(calculatedInitiallyHidden);
  const [isExpanded, setIsExpanded] = useState(false);

  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [contentDims, setContentDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Only update hidden state from props if initiallyHidden isn't explicitly set to false
    if (props.initiallyHidden !== false) {
      setHidden(calculatedInitiallyHidden);
    }
  }, [calculatedInitiallyHidden, props.initiallyHidden]);

  useEffect(() => {
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(() => {
      setContentDims({
        width: contentElement.scrollWidth,
        height: contentElement.scrollHeight,
      });
    });

    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [contentElement]);

  return (
    <PreviewDiv
      spellCheck={false}
      borderColor={
        props.isSelected ? vscBadgeBackground : vscCommandCenterInactiveBorder
      }
      className="find-widget-skip !my-0"
      contentEditable={false}
    >
      <div
        className="border-b-command-border m-0 flex cursor-pointer items-center justify-between break-all border-0 border-b-[1px] border-solid px-[5px] py-1.5 hover:opacity-90"
        style={{
          fontSize: getFontSize() - 3,
        }}
        onClick={() => {
          setHidden(!hidden);
        }}
      >
        <div
          className={`flex items-center gap-1 text-[11px] ${!!props.onTitleClick ? "hover:underline" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (props.onTitleClick) {
              props.onTitleClick(e);
            }
          }}
        >
          {props.icon}
          {props.title}
        </div>
        <div className="flex items-center gap-1">
          <HeaderButtonWithToolTip text={hidden ? "Show" : "Hide"}>
            {!!props.children &&
              (hidden ? (
                <EyeIcon className="h-2.5 w-2.5" />
              ) : (
                <EyeSlashIcon className="h-2.5 w-2.5" />
              ))}
          </HeaderButtonWithToolTip>
          {props.onDelete && (
            <HeaderButtonWithToolTip
              text="Delete"
              onClick={(e) => {
                e.stopPropagation();
                props.onDelete?.();
              }}
            >
              <XMarkIcon className="h-2.5 w-2.5" />
            </HeaderButtonWithToolTip>
          )}
        </div>
      </div>

      {!hidden && !!props.children && (
        <ContentContainer expanded={isExpanded}>
          <ScrollableContent
            ref={setContentElement}
            shouldShowChevron={contentDims.height > MAX_PREVIEW_HEIGHT}
          >
            {props.children}
          </ScrollableContent>

          {contentDims.height > MAX_PREVIEW_HEIGHT && (
            <ChevronContainer>
              <HeaderButtonWithToolTip
                text={isExpanded ? "Collapse" : "Expand"}
              >
                <ChevronDownIcon
                  className="h-3 w-3 transition-all"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "",
                  }}
                  onClick={() => setIsExpanded((v) => !v)}
                />
              </HeaderButtonWithToolTip>
            </ChevronContainer>
          )}
        </ContentContainer>
      )}
    </PreviewDiv>
  );
}

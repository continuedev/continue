import { Popover } from "@headlessui/react";
import {
  ChevronDownIcon,
  DocumentIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscInputBackground } from "../..";
import { useAuth } from "../../../context/Auth";
import AddModelForm from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  cycleDefaultModel,
  selectDefaultModel,
} from "../../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { cycleProfile } from "../../../redux/thunks/cycleProfile";
import { getFontSize, isMetaEquivalentKeyPressed } from "../../../util";
import PopoverTransition from "../../mainInput/InputToolbar/PopoverTransition";
import { AssistantSelect } from "./AssistantSelect";
import { ModelSelect, modelSelectTitle } from "./ModelSelect";
import { MAX_HEIGHT_PX } from "./shared";

const StyledPopoverButton = styled(Popover.Button)`
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 2px;
  border: none;
  cursor: pointer;
  font-size: ${getFontSize() - 2}px;
  background: transparent;
  color: ${lightGray};
  &:focus {
    outline: none;
  }
`;

const StyledPopoverPanel = styled(Popover.Panel)<{ $showabove: boolean }>`
  margin-top: 4px;
  position: absolute;
  padding: 0px;
  cursor: default;

  display: flex;
  flex-direction: row;

  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${vscInputBackground};

  ${(props) => (props.$showabove ? "bottom: 100%;" : "top: 100%;")}
`;

function AssistantAndModelSelect() {
  const dispatch = useAppDispatch();
  const defaultModel = useAppSelector(selectDefaultModel);
  const [showAbove, setShowAbove] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedProfileId = useAppSelector(
    (store) => store.session.selectedProfileId,
  );

  const { profiles, selectedProfile } = useAuth();

  useEffect(() => {
    const handleResize = () => calculatePosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function calculatePosition() {
    if (!buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = MAX_HEIGHT_PX;

    setShowAbove(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }

  function onClickAddModel(e: any) {
    e.stopPropagation();
    e.preventDefault();

    // Close the dropdown
    if (buttonRef.current) {
      buttonRef.current.click();
    }
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  useEffect(() => {
    let lastToggleTime = 0;
    const DEBOUNCE_MS = 500;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "'" && isMetaEquivalentKeyPressed(event as any)) {
        const now = Date.now();

        if (event.shiftKey) {
          dispatch(cycleDefaultModel("next"));
        } else {
          if (now - lastToggleTime >= DEBOUNCE_MS) {
            dispatch(cycleProfile());
            lastToggleTime = now;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <Popover>
      <div className="relative">
        <StyledPopoverButton
          data-testid="model-select-button"
          ref={buttonRef}
          className="h-[18px] overflow-hidden"
          style={{ padding: 0 }}
          onClick={calculatePosition}
        >
          <div className="flex max-w-[33vw] items-center gap-0.5 text-gray-400 transition-colors duration-200">
            {selectedProfile?.id === "local" ? (
              <>
                <DocumentIcon
                  className="mr-1 h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {modelSelectTitle(defaultModel) || "Select model"}
                </span>
              </>
            ) : (
              <>
                <SparklesIcon
                  className="mr-1 h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {selectedProfile?.title || "Select assistant"}
                  {" / "}
                  {modelSelectTitle(defaultModel) || "Select model"}
                </span>
              </>
            )}
            <ChevronDownIcon
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />
          </div>
        </StyledPopoverButton>
        <PopoverTransition>
          <StyledPopoverPanel
            $showabove={showAbove}
            className="flex max-w-[90vw] overflow-hidden"
            style={{ zIndex: 1000 }}
          >
            <AssistantSelect
              onClose={() => {
                if (buttonRef.current) {
                  buttonRef.current.click();
                }
              }}
            />
            <ModelSelect
              selectedProfileId={selectedProfileId}
              onClickAddModel={onClickAddModel}
            />
          </StyledPopoverPanel>
        </PopoverTransition>
      </div>
    </Popover>
  );
}

export default AssistantAndModelSelect;

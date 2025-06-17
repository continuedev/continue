// gui/src/components/mainInput/Lump/sections/rules/RulePolicyItem.tsx
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { RuleWithSource } from "core";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../../../redux/hooks";
import {
  addRule,
  toggleRuleSetting,
} from "../../../../../redux/slices/uiSlice";
import { useFontSize } from "../../../../ui/font";

interface RulePolicyItemProps {
  rule: RuleWithSource;
}

export function RulePolicyItem(props: RulePolicyItemProps) {
  const dispatch = useDispatch();
  const policy = useAppSelector(
    (state) => state.ui.ruleSettings[props.rule.name],
  );
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!policy) {
      dispatch(addRule(props.rule));
    }
  }, [props.rule.name, policy]);

  const fontSize = useFontSize(-2);

  if (!policy) {
    return null;
  }

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div className="flex flex-row items-center">
        <div
          className={`hover:bg-list-active hover:text-list-active-foreground xs:gap-1.5 flex flex-1 cursor-pointer flex-row items-center gap-1 py-0.5 pl-1 pr-2`}
          onClick={() => setIsExpanded((val) => !val)}
        >
          <ChevronRightIcon
            className={`xs:flex hidden h-3 w-3 flex-shrink-0 transition-all duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />

          <div
            className={`flex items-center gap-1 rounded-md`}
            style={{
              fontSize,
            }}
          >
            <span className="line-clamp-1 break-all">{props.rule.name}</span>
          </div>
        </div>
        <div
          className={`hover:bg-list-active hover:text-list-active-foreground flex w-8 cursor-pointer flex-row items-center justify-end gap-2 px-2 py-0.5 sm:w-16`}
          data-testid={`rule-policy-item-${props.rule.name}`}
          onClick={(e) => {
            dispatch(toggleRuleSetting(props.rule.name));
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {policy === "never" ? (
            <>
              <span className="text-lightgray sm:hidden">Off</span>
              <span className="text-lightgray hidden sm:inline-block">
                Never
              </span>
            </>
          ) : policy === "auto" ? (
            <>
              <span className="text-success sm:hidden">Auto</span>
              <span className="text-success hidden sm:inline-block">Auto</span>
            </>
          ) : (
            // always
            <>
              <span className="text-warning sm:hidden">On</span>
              <span className="text-warning hidden sm:inline-block">
                Always
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className={`flex flex-col overflow-hidden ${isExpanded ? "h-min" : "h-0 opacity-0"} gap-x-1 gap-y-2 pl-2 transition-all`}
      >
        <span className="mt-1.5 text-xs font-bold">Rule:</span>
        <span className="italic">{props.rule.rule}</span>
        {props.rule.globs && (
          <>
            <span className="text-xs font-bold">Applies to:</span>
            <span>
              {typeof props.rule.globs === "string"
                ? props.rule.globs
                : props.rule.globs.join(", ")}
            </span>
          </>
        )}
        {props.rule.ruleFile && (
          <>
            <span className="text-xs font-bold">Source:</span>
            <span>{props.rule.ruleFile}</span>
          </>
        )}
        <div className="h-1"></div>
      </div>
    </div>
  );
}

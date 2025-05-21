import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { isJetBrains } from "../util";
import {
  clearThemeLocalCache,
  setDocumentStylesFromTheme,
  THEME_COLORS,
} from "./theme";

const ThemeTailwindClassExample = ({
  className,
  varName,
  defaultColor,
  isMissing,
}: {
  className: string;
  varName: string;
  defaultColor: string;
  isMissing?: boolean;
}) => {
  return (
    <>
      <div className={`line-clamp-1 break-all px-2 text-right`}>
        {className}
      </div>
      <div
        className={`line-clamp-1 break-all p-1 text-[9px] ${isMissing ? "text-error" : ""}`}
        style={{
          backgroundColor: `var(${varName})`,
        }}
      >
        {varName}
      </div>
      <div
        className={`line-clamp-1 break-all p-1 text-[9px]`}
        style={{
          backgroundColor: defaultColor,
        }}
      >
        {defaultColor}
      </div>
    </>
  );
};

function ThemePage() {
  const navigate = useNavigate();
  const [listToggled, setListToggled] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);
  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);

  const refreshJetbrainsColors = () => {
    ideMessenger.request("jetbrains/getColors", undefined).then((result) => {
      console.log(result);
      if (result.status === "success") {
        setDocumentStylesFromTheme(result.content);
      }
    });
  };

  const [missingVars, setMissingVars] = useState<string[]>([]);
  const checkMissingClasses = () => {
    const missingVars: string[] = [];
    Object.entries(THEME_COLORS).forEach(([colorName, themeVals]) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(
        themeVals.var,
      );
      if (!value) {
        missingVars.push(`${colorName}`); //: ${themeVals.var}`);
      }
    });
    setMissingVars(missingVars);
  };
  useEffect(() => {
    checkMissingClasses();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-3 px-2 py-2">
      <span
        className="flex cursor-pointer flex-row items-center gap-2"
        onClick={() => navigate("/more")}
      >
        <span className="">←</span>
        Back to Settings
      </span>

      <div className="bg-background border-border grid grid-cols-1 gap-4 rounded-md border border-solid p-4 md:grid-cols-2">
        <div className="col-span-2 flex gap-4">
          <p className="">Normal text</p>
          <p className="text-description">Description text</p>
          <p className="text-description-muted">Muted text</p>
        </div>

        <button className="bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer rounded border-none px-4 py-2 disabled:cursor-not-allowed disabled:brightness-75">
          Primary Button
        </button>
        <button className="bg-secondary text-secondary-foreground hover:bg-secondary-hover cursor-pointer rounded border-none px-4 py-2 disabled:cursor-not-allowed disabled:brightness-75">
          Secondary Button
        </button>

        <div className="border-border rounded-md border border-solid p-3">
          Normal border
        </div>

        <div className="border-border-focus rounded-md border border-solid p-3">
          Focus border
        </div>

        <input
          className="bg-input text-input-foreground border-input-border focus:border-border-focus active:border-border-focus active:ring-border-focus placeholder:text-input-placeholder focus:bg-input-focus focus:text-input-focus-foreground rounded-md border border-solid p-2 focus:ring-0"
          placeholder="Input example"
        />

        <div className="bg-badge text-badge-foreground border-border inline-block rounded-full border border-solid p-2">
          <span className="px-2">Badge</span>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="text-success h-4 w-4" />
            <span className="text-success">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <ExclamationCircleIcon className="text-warning h-4 w-4" />
            <span className="text-warning">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-error h-4 w-4" />
            <span className="text-error">Error</span>
          </div>
        </div>

        <div
          onClick={() => setListToggled(!listToggled)}
          className={`cursor-pointer p-2 ${listToggled ? "bg-list-active text-list-active-foreground" : "bg-background text-foreground hover:bg-list-hover"}`}
        >
          List item (click to select)
        </div>
        <div className="bg-editor text-editor-foreground border-border rounded-sm border border-solid p-2">
          <span>Editor</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="mb-2 mt-6 text-xl font-semibold">
          Missing Theme Variables
        </h2>
        {missingVars.length > 0 ? (
          <div className="flex flex-col gap-1">
            {missingVars.map((varName) => (
              <div key={varName} className="text-error">
                {varName}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-success">No missing variables</div>
        )}
        <Button onClick={checkMissingClasses}>
          Re-check Missing Theme Vars
        </Button>
      </div>
      {jetbrains ? (
        <>
          <h2 className="mb-2 mt-6 text-xl font-semibold">
            Manage Jetbrains Theme
          </h2>
          <div className="flex flex-col flex-wrap gap-2">
            <Button onClick={refreshJetbrainsColors}>
              Refresh Jetbrains Theme
            </Button>
            <Button onClick={clearThemeLocalCache}>Clear Theme Cache</Button>
          </div>
        </>
      ) : null}
      <h2 className="mb-2 mt-6 text-xl font-semibold">All Theme Colors</h2>
      <div className="grid grid-cols-3">
        <div className="p-1">
          <span className="font-bold">Tailwind Class</span>
        </div>
        <div className="p-1">
          <span className="font-bold">CSS Var</span>
        </div>
        <div className="p-1">
          <span className="font-bold">Fallback</span>
        </div>
        {Object.entries(THEME_COLORS).map(([colorName, val]) => (
          <ThemeTailwindClassExample
            isMissing={missingVars.includes(colorName)}
            key={colorName}
            className={colorName}
            defaultColor={val.default}
            varName={val.var}
          />
        ))}
      </div>
    </div>
  );
}
export default ThemePage;

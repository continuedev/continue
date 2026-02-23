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
import { ROUTES } from "../util/navigation";
import {
  clearThemeLocalCache,
  setDocumentStylesFromTheme,
  THEME_COLORS,
  varWithFallback,
} from "./theme";

const ThemeTailwindClassExample = ({
  colorName,
  varNames,
  defaultColor,
  isMissing,
}: {
  colorName: string;
  varNames: string[];
  defaultColor: string;
  isMissing?: boolean;
}) => {
  return (
    <>
      <div className={`line-clamp-1 break-all px-2 text-right`}>
        {colorName}
      </div>
      <div
        className={`line-clamp-1 break-all p-1 text-[9px] ${isMissing ? "text-error" : ""}`}
        style={{
          backgroundColor: varWithFallback(
            colorName as keyof typeof THEME_COLORS,
          ),
        }}
      >
        {varNames.join(", ")}
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

  const [missingVars, setMissingVars] = useState<string[]>([]);
  const refreshColors = () => {
    if (jetbrains) {
      // Jetbrains: get colors and check which ones are missing from theme
      void ideMessenger
        .request("jetbrains/getColors", undefined)
        .then((result) => {
          console.log(result);
          if (result.status === "success") {
            const missingColors = setDocumentStylesFromTheme(result.content);
            setMissingVars(missingColors);
          }
        });
    } else {
      // VS Code: find actual missing CSS variables
      const notFound: string[] = [];
      Object.entries(THEME_COLORS).forEach(([colorName, themeVals], idx) => {
        let found = false;
        themeVals.vars.forEach((cssVar) => {
          const value = getComputedStyle(
            document.documentElement,
          ).getPropertyValue(cssVar);
          if (!value) {
            notFound.push(`cssVar (choice #${idx + 1} for color ${colorName}`);
          }
        });
      });
      setMissingVars(notFound);
    }
  };

  useEffect(() => {
    refreshColors();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-3 px-2 py-2">
      <span
        className="flex cursor-pointer flex-row items-center gap-2"
        onClick={() => navigate(ROUTES.HOME)}
      >
        <span className="">←</span>
        Back to Chat
      </span>
      <h2 className="mb-2 mt-0 p-0 text-center text-xl font-semibold">
        Theme Tester
      </h2>
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
          className="bg-input text-input-foreground border-input-border placeholder:text-input-placeholder focus:border-border-focus rounded-md border border-solid p-2 focus:outline-none"
          placeholder="Input example"
        />

        <div className="bg-badge text-badge-foreground border-border inline-block rounded-full border border-solid p-2">
          <span className="px-2">Badge</span>
        </div>

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

        <div
          onClick={() => setListToggled(!listToggled)}
          className={`cursor-pointer p-2 ${listToggled ? "bg-list-active text-list-active-foreground" : "bg-background text-foreground hover:bg-list-hover"}`}
        >
          List item (clickable)
        </div>
        <div className="bg-editor text-editor-foreground border-border rounded-sm border border-solid p-2">
          <span>Editor</span>
        </div>
        <table>
          <tbody>
            <tr>
              <td className="border-border border-b border-solid p-2">
                <span>even table row</span>
              </td>
            </tr>
            <tr className="bg-table-oddRow">
              <td className="border-border border-b border-solid p-2">
                <span>odd table row</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <span className="text-link">Link</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-findMatch">find match</span>
          <span className="bg-findMatch-selected">current match</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="">Accent</span>
          <div className="bg-accent h-3 w-3" />
        </div>
      </div>
      <h2 className="mb-2 mt-6 text-xl font-semibold">Manage Theme</h2>
      <h2 className="mb-2 text-lg font-semibold">Missing Theme Colors</h2>
      {missingVars.length > 0 ? (
        <div className="flex flex-col gap-1">
          {missingVars.map((varName) => (
            <div key={varName} className="">
              {varName}
            </div>
          ))}
        </div>
      ) : (
        <div className="">No missing variables</div>
      )}
      <Button onClick={refreshColors}>Refresh Missing Colors</Button>
      {jetbrains ? (
        <Button onClick={clearThemeLocalCache}>Clear Theme Cache</Button>
      ) : null}
      <h2 className="mb-2 mt-6 text-xl font-semibold">All Theme Colors</h2>
      <div className="grid grid-cols-3">
        <div className="p-1">
          <span className="font-bold">Theme Color</span>
        </div>
        <div className="p-1">
          <span className="font-bold">CSS Var</span>
        </div>
        <div className="p-1">
          <span className="font-bold">Default</span>
        </div>
        {Object.entries(THEME_COLORS).map(([colorName, val]) => (
          <ThemeTailwindClassExample
            isMissing={missingVars.includes(colorName)}
            key={colorName}
            colorName={colorName}
            defaultColor={val.default}
            varNames={val.vars}
          />
        ))}
      </div>
    </div>
  );
}
export default ThemePage;

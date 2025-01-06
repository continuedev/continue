import { useNavigate } from "react-router-dom";
import { CheckIcon, XIcon } from "@heroicons/react/solid";
import { vscodeCssClasses } from "./vscode-classes";
import { VSC_THEME_COLOR_VARS } from "../../components";

interface ThemeExampleProps {
  className: string;
}

const TAILWIND_CLASSES = [
  // TODO
  "error",
];

const ThemeVariableExample = ({ varName }: { varName: string }) => {
  return (
    <div className="flex flex-row items-center justify-end gap-2">
      <span className="lines lines-1">{varName}</span>
      <div
        className={`h-6 w-12`}
        style={{
          backgroundColor: `var(${varName})`,
        }}
      ></div>
    </div>
  );
};

const ThemeTailwindClassExample = ({ className }: { className: string }) => {
  return (
    <div className="flex flex-row items-center justify-end gap-2">
      <span className="lines lines-1">{className}</span>
      <div className={`h-6 w-12 bg-${className}`}></div>
    </div>
  );
};

export default function ThemePage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col px-2 py-2">
      <span
        className="cursor-pointer underline"
        onClick={() => navigate("/more")}
      >
        Back to more page
      </span>
      <p className="">More pretty than this</p>
      <div className="flex flex-col">
        {VSC_THEME_COLOR_VARS.map((c) => (
          <ThemeVariableExample key={c} varName={c} />
        ))}
        {TAILWIND_CLASSES.map((c) => (
          <ThemeTailwindClassExample key={c} className={c} />
        ))}
      </div>
    </div>
  );
}

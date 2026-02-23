import {
  ArrowPathRoundedSquareIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
// @ts-ignore
import Panzoom from "@panzoom/panzoom";
// @ts-ignore
import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { useDebouncedEffect } from "../find/useDebounce";
import { ToolTip } from "../gui/Tooltip";

const MINIMUM_ZOOM_STEP = 0.05;

const MERMAID_THEME_COLORS = {
  background: "#1e1e1e",
  primaryColor: "#4d8bf0",
  primaryTextColor: "#ffffff",
  primaryBorderColor: "#4d8bf0",
  secondaryColor: "#3a6db3",
  secondaryTextColor: "#ffffff",
  secondaryBorderColor: "#3a6db3",
  tertiaryColor: "#59bc89",
  tertiaryTextColor: "#ffffff",
  tertiaryBorderColor: "#59bc89",
  noteBkgColor: "#2d2d2d",
  noteTextColor: "#e6e6e6",
  noteBorderColor: "#555555",
  lineColor: "#8c8c8c",
  textColor: "#e6e6e6",
  mainBkg: "#252525",
  errorBkgColor: "#f44336",
  errorTextColor: "#ffffff",
  nodeBorder: "#555555",
  clusterBkg: "#2a2a2a",
  clusterBorder: "#555555",
  defaultLinkColor: "#8c8c8c",
  titleColor: "#e6e6e6",
  edgeLabelBackground: "#252525",
  activeTaskBkgColor: "#4caf50",
  activeTaskBorderColor: "#388e3c",
  doneTaskBkgColor: "#388e3c",
  doneTaskBorderColor: "#2e7d32",
  critBkgColor: "#f44336",
  critBorderColor: "#d32f2f",
  taskTextColor: "#e6e6e6",
  taskTextOutsideColor: "#e6e6e6",
  taskTextLightColor: "#b3b3b3",
  sectionBkgColor: "#2a2a2a",
  altSectionBkgColor: "#303030",
  sectionBkgColor2: "#252525",
  excludeBkgColor: "#2d2d2d",
  fillType0: "#264f78",
  fillType1: "#3a6db3",
  fillType2: "#59bc89",
  fillType3: "#4d8bf0",
  fillType4: "#3a6db3",
  fillType5: "#264f78",
  fillType6: "#59bc89",
  fillType7: "#4d8bf0",
};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "dark",
  themeVariables: {
    ...MERMAID_THEME_COLORS,
    fontSize: "14px",
    fontFamily: "var(--vscode-font-family)",
  },
});

export default function MermaidDiagram({ code }: { code: string }) {
  const mermaidRenderContainerRef = useRef<HTMLDivElement>(null);
  const zoomInButtonRef = useRef<SVGSVGElement>(null);
  const zoomOutButtonRef = useRef<SVGSVGElement>(null);
  const resetZoomButtonRef = useRef<SVGSVGElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
  }, [code]);

  useDebouncedEffect(
    () => {
      if (mermaidRenderContainerRef.current) {
        mermaidRenderContainerRef.current.innerHTML = "";
      }
      const diagramId = `mermaid-id-${Math.random().toString(36).substring(2)}`;
      void (async () => {
        if (!mermaidRenderContainerRef.current) return;
        try {
          await mermaid.parse(code);
          const renderedSVG = await mermaid.render(diagramId, code);
          mermaidRenderContainerRef.current.innerHTML = renderedSVG.svg;
          setError("");
          const panzoom = Panzoom(mermaidRenderContainerRef.current, {
            step: MINIMUM_ZOOM_STEP,
          });
          zoomInButtonRef.current?.addEventListener("click", () =>
            panzoom.zoomIn({ step: MINIMUM_ZOOM_STEP * 4 }),
          );
          zoomOutButtonRef.current?.addEventListener("click", () =>
            panzoom.zoomOut({ step: MINIMUM_ZOOM_STEP * 4 }),
          );
          resetZoomButtonRef.current?.addEventListener("click", () =>
            panzoom.reset(),
          );
          mermaidRenderContainerRef.current.parentElement?.addEventListener(
            "wheel",
            (event) => {
              if (!event.shiftKey) return;
              panzoom.zoomWithWheel(event);
            },
          );
        } catch (err: any) {
          if (err.message) {
            setError(err.message);
          } else {
            setError(
              "Unknown error when parsing or rendering the Mermaid diagram.",
            );
          }
        }
        setIsLoading(false);
      })();
    },
    500,
    [code],
  );

  return (
    <>
      {isLoading && (
        <div className="text-vsc-foreground text-xs">Generating diagram...</div>
      )}
      {!!error ? (
        <div className="text-error whitespace-pre text-sm">{error}</div>
      ) : (
        <div className="mermaid relative">
          <div className="absolute right-0 z-10 m-2 flex items-center gap-x-1">
            <ToolTip content={"Zoom In"}>
              <MagnifyingGlassPlusIcon
                ref={zoomInButtonRef}
                className="h-4 w-4 cursor-pointer"
              />
            </ToolTip>
            <ToolTip content={"Zoom Out"}>
              <MagnifyingGlassMinusIcon
                ref={zoomOutButtonRef}
                className="h-4 w-4 cursor-pointer"
              />
            </ToolTip>

            <ToolTip content="Reset Zoom">
              <ArrowPathRoundedSquareIcon
                ref={resetZoomButtonRef}
                className="h-4 w-4 cursor-pointer"
              />
            </ToolTip>
          </div>
          <div
            className="flex min-h-5 justify-center"
            ref={mermaidRenderContainerRef}
          />
        </div>
      )}
    </>
  );
}

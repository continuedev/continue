// @ts-ignore
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { themeIcons } from "seti-file-icons";

export interface FileIconProps {
  height: `${number}px`;
  width: `${number}px`;
  filename: string;
}

export default function FileIcon({ filename, height, width }: FileIconProps) {
  const file = useMemo(() => {
    if (filename.includes(" (")) {
      const path = filename.split(" ");
      path.pop();
      return path.join(" ");
    } else {
      return filename;
    }
  }, [filename]);

  const getIcon = themeIcons({
    blue: "#268bd2",
    grey: "#657b83",
    "grey-light": "#839496",
    green: "#859900",
    orange: "#cb4b16",
    pink: "#d33682",
    purple: "#6c71c4",
    red: "#dc322f",
    white: "#fdf6e3",
    yellow: "#b58900",
    ignore: "#586e75",
  });

  // Sanitize the SVG string before rendering it
  const { svg, color } = getIcon(file);
  const sanitizedSVG = DOMPurify.sanitize(svg);

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitizedSVG }}
      style={{
        width: width,
        height: height,
        fill: color,
        flexShrink: 0,
        display: "flex",
      }}
    />
  );
}

import DOMPurify from "dompurify";
import { themeIcons } from "seti-file-icons";

const FileIcon = ({ filename, height, width }) => {
  const filenameParts = filename.includes(" (")
    ? filename.split(" ")
    : [filename, ""];
  filenameParts.pop();
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
  const { svg, color } = getIcon(filenameParts.join(" "));
  const sanitizedSVG = DOMPurify.sanitize(svg);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizedSVG }}
      style={{ width: width, height: height, fill: color, flexShrink: 0 }}
    />
  );
};

export default FileIcon;

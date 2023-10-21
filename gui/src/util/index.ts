type Platform = "mac" | "linux" | "windows" | "unknown";

export function getPlatform(): Platform {
  const platform = window.navigator.platform.toUpperCase();
  if (platform.indexOf("MAC") >= 0) {
    return "mac";
  } else if (platform.indexOf("LINUX") >= 0) {
    return "linux";
  } else if (platform.indexOf("WIN") >= 0) {
    return "windows";
  } else {
    return "unknown";
  }
}

export function isMetaEquivalentKeyPressed(event: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return event.metaKey;
    case "linux":
    case "windows":
      return event.ctrlKey;
    default:
      return event.metaKey;
  }
}

export function getMetaKeyLabel(): string {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌘";
    case "linux":
    case "windows":
      return "^";
    default:
      return "⌘";
  }
}

export function getFontSize(): number {
  const fontSize = localStorage.getItem("fontSize");
  return fontSize ? parseInt(fontSize) : 13;
}

export function getMarkdownLanguageTagForFile(filepath: string): string {
  const ext = filepath.split(".").pop();
  switch (ext) {
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "java":
      return "java";
    case "go":
      return "go";
    case "rb":
      return "ruby";
    case "rs":
      return "rust";
    case "c":
      return "c";
    case "cpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "php":
      return "php";
    case "scala":
      return "scala";
    case "swift":
      return "swift";
    case "kt":
      return "kotlin";
    case "md":
      return "markdown";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sh":
      return "shell";
    case "yaml":
      return "yaml";
    case "toml":
      return "toml";
    case "tex":
      return "latex";
    case "sql":
      return "sql";
    default:
      return "";
  }
}

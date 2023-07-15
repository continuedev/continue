type Platform = "mac" | "linux" | "windows" | "unknown";

function getPlatform(): Platform {
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

function isMetaEquivalentKeyPressed(event: {
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

import { GB, KB, MB } from "./sizeUtils";

export function formatSize(bytes: number, precision: number = 1): string {
  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(precision)} GB`;
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(precision)} MB`;
  }
  if (bytes >= KB) {
    return `${(bytes / KB).toFixed(precision)} KB`;
  }
  return `${bytes} B`;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 900) { // 15 minutes
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
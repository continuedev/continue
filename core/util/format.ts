/**
 * Pure display formatters.
 * Ported from Marcel (src/utils/format.ts).
 */

import { getRelativeTimeFormat, getTimeZone } from "./intl.js";

/**
 * Formats a byte count to a human-readable string (KB, MB, GB).
 * @example formatFileSize(1536) → "1.5KB"
 */
export function formatFileSize(sizeInBytes: number): string {
  const kb = sizeInBytes / 1024;
  if (kb < 1) {
    return `${sizeInBytes} bytes`;
  }
  if (kb < 1024) {
    return `${kb.toFixed(1).replace(/\.0$/, "")}KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1).replace(/\.0$/, "")}MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1).replace(/\.0$/, "")}GB`;
}

/**
 * Formats milliseconds as seconds with 1 decimal place (e.g. `1234` → `"1.2s"`).
 * Unlike formatDuration, always keeps the decimal — use for sub-minute timings
 * where the fractional second is meaningful (TTFT, hook durations, etc.).
 */
export function formatSecondsShort(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDuration(
  ms: number,
  options?: { hideTrailingZeros?: boolean; mostSignificantOnly?: boolean },
): string {
  if (ms < 60000) {
    if (ms === 0) {
      return "0s";
    }
    if (ms < 1) {
      const s = (ms / 1000).toFixed(1);
      return `${s}s`;
    }
    const s = Math.floor(ms / 1000).toString();
    return `${s}s`;
  }

  let days = Math.floor(ms / 86400000);
  let hours = Math.floor((ms % 86400000) / 3600000);
  let minutes = Math.floor((ms % 3600000) / 60000);
  let seconds = Math.round((ms % 60000) / 1000);

  // Handle rounding carry-over (e.g., 59.5s rounds to 60s)
  if (seconds === 60) {
    seconds = 0;
    minutes++;
  }
  if (minutes === 60) {
    minutes = 0;
    hours++;
  }
  if (hours === 24) {
    hours = 0;
    days++;
  }

  const hide = options?.hideTrailingZeros;

  if (options?.mostSignificantOnly) {
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  if (days > 0) {
    if (hide && hours === 0 && minutes === 0) return `${days}d`;
    if (hide && minutes === 0) return `${days}d ${hours}h`;
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    if (hide && minutes === 0 && seconds === 0) return `${hours}h`;
    if (hide && seconds === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    if (hide && seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// `new Intl.NumberFormat` is expensive; cache formatters for reuse.
let numberFormatterConsistent: Intl.NumberFormat | null = null;
let numberFormatterInconsistent: Intl.NumberFormat | null = null;

function getNumberFormatter(useConsistentDecimals: boolean): Intl.NumberFormat {
  if (useConsistentDecimals) {
    if (!numberFormatterConsistent) {
      numberFormatterConsistent = new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      });
    }
    return numberFormatterConsistent;
  } else {
    if (!numberFormatterInconsistent) {
      numberFormatterInconsistent = new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      });
    }
    return numberFormatterInconsistent;
  }
}

/** Format a number with compact notation, e.g. `1321` → `"1.3k"`. */
export function formatNumber(number: number): string {
  const shouldUseConsistentDecimals = number >= 1000;
  return getNumberFormatter(shouldUseConsistentDecimals)
    .format(number)
    .toLowerCase();
}

/** Format a token count with compact notation, removing trailing `.0`. */
export function formatTokens(count: number): string {
  return formatNumber(count).replace(".0", "");
}

type RelativeTimeStyle = "long" | "short" | "narrow";

type RelativeTimeOptions = {
  style?: RelativeTimeStyle;
  numeric?: "always" | "auto";
};

export function formatRelativeTime(
  date: Date,
  options: RelativeTimeOptions & { now?: Date } = {},
): string {
  const { style = "narrow", numeric = "always", now = new Date() } = options;
  const diffInMs = date.getTime() - now.getTime();
  const diffInSeconds = Math.trunc(diffInMs / 1000);

  const intervals = [
    { unit: "year", seconds: 31536000, shortUnit: "y" },
    { unit: "month", seconds: 2592000, shortUnit: "mo" },
    { unit: "week", seconds: 604800, shortUnit: "w" },
    { unit: "day", seconds: 86400, shortUnit: "d" },
    { unit: "hour", seconds: 3600, shortUnit: "h" },
    { unit: "minute", seconds: 60, shortUnit: "m" },
    { unit: "second", seconds: 1, shortUnit: "s" },
  ] as const;

  for (const { unit, seconds: intervalSeconds, shortUnit } of intervals) {
    if (Math.abs(diffInSeconds) >= intervalSeconds) {
      const value = Math.trunc(diffInSeconds / intervalSeconds);
      if (style === "narrow") {
        return diffInSeconds < 0
          ? `${Math.abs(value)}${shortUnit} ago`
          : `in ${value}${shortUnit}`;
      }
      return getRelativeTimeFormat("long", numeric).format(
        value,
        unit as Intl.RelativeTimeFormatUnit,
      );
    }
  }

  if (style === "narrow") {
    return diffInSeconds <= 0 ? "0s ago" : "in 0s";
  }
  return getRelativeTimeFormat(style, numeric).format(0, "second");
}

export function formatRelativeTimeAgo(
  date: Date,
  options: RelativeTimeOptions & { now?: Date } = {},
): string {
  const { now = new Date(), ...restOptions } = options;
  if (date > now) {
    return formatRelativeTime(date, { ...restOptions, now });
  }
  return formatRelativeTime(date, { ...restOptions, numeric: "always", now });
}

export function formatLogMetadata(log: {
  modified: Date;
  messageCount: number;
  fileSize?: number;
  gitBranch?: string;
  tag?: string;
  agentSetting?: string;
  prNumber?: number;
  prRepository?: string;
}): string {
  const sizeOrCount =
    log.fileSize === undefined
      ? `${log.messageCount} messages`
      : formatFileSize(log.fileSize);
  const parts = [
    formatRelativeTimeAgo(log.modified, { style: "short" }),
    ...(log.gitBranch ? [log.gitBranch] : []),
    sizeOrCount,
  ];
  if (log.tag) {
    parts.push(`#${log.tag}`);
  }
  if (log.agentSetting) {
    parts.push(`@${log.agentSetting}`);
  }
  if (log.prNumber) {
    parts.push(
      log.prRepository
        ? `${log.prRepository}#${log.prNumber}`
        : `#${log.prNumber}`,
    );
  }
  return parts.join(" · ");
}

export function formatResetTime(
  timestampInSeconds: number | undefined,
  showTimezone = false,
  showTime = true,
): string | undefined {
  if (!timestampInSeconds) return undefined;

  const date = new Date(timestampInSeconds * 1000);
  const now = new Date();
  const minutes = date.getMinutes();
  const hoursUntilReset = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilReset > 24) {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      hour: showTime ? "numeric" : undefined,
      minute: !showTime || minutes === 0 ? undefined : "2-digit",
      hour12: showTime ? true : undefined,
    };

    if (date.getFullYear() !== now.getFullYear()) {
      dateOptions.year = "numeric";
    }

    const dateString = date.toLocaleString("en-US", dateOptions);
    return (
      dateString.replace(/ ([AP]M)/i, (_match, ampm) => ampm.toLowerCase()) +
      (showTimezone ? ` (${getTimeZone()})` : "")
    );
  }

  const timeString = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: minutes === 0 ? undefined : "2-digit",
    hour12: true,
  });

  return (
    timeString.replace(/ ([AP]M)/i, (_match, ampm) => ampm.toLowerCase()) +
    (showTimezone ? ` (${getTimeZone()})` : "")
  );
}

export function formatResetText(
  resetsAt: string,
  showTimezone = false,
  showTime = true,
): string {
  const date = new Date(resetsAt);
  return `${formatResetTime(Math.floor(date.getTime() / 1000), showTimezone, showTime)}`;
}

export {
  truncate,
  truncatePathMiddle,
  truncateStartToWidth,
  truncateToWidth,
  truncateToWidthNoEllipsis,
  wrapText,
} from "./truncate.js";

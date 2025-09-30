import { CSSProperties, useEffect, useRef } from "react";

/**
 * useRenderDebug
 *
 * Developer utility to visualize component re-renders.
 *
 * - Returns a `ref` to attach to a container element and a `count` that
 *   increments on every render of the component using this hook.
 * - On each render, it briefly adds a CSS class (default: `rerender-flash`)
 *   to the element for a quick visual flash.
 * - Use together with <RenderCountBadge /> to show the render count inline.
 *
 * Options:
 * - enabled: boolean to toggle the effect (default true)
 * - flashClassName: class added on each render (default `rerender-flash`)
 * - flashDurationMs: duration of the flash animation in ms (default 180)
 */

export function useRenderDebug(options?: {
  enabled?: boolean;
  flashClassName?: string;
  flashDurationMs?: number;
}) {
  const {
    enabled = true,
    flashClassName = "rerender-flash",
    flashDurationMs = 180,
  } = options || {};

  const ref = useRef<HTMLElement | null>(null);
  const countRef = useRef(0);
  countRef.current += 1;

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    el.classList.add(flashClassName);
    const t = setTimeout(
      () => el.classList.remove(flashClassName),
      flashDurationMs,
    );
    return () => {
      clearTimeout(t);
      // Ensure we don't leave the flash class applied on cleanup
      el.classList.remove(flashClassName);
    };
  });

  return { ref, count: countRef.current, countRef } as const;
}

export function RenderCountBadge(props: {
  count: number;
  title?: string;
  style?: CSSProperties;
  className?: string;
}) {
  // Simple badge for use with useRenderDebug; keep lightweight.
  const { count, title = `Renders: ${count}`, style, className } = props;
  return (
    <span
      className={`render-count ${className || ""}`}
      title={title}
      style={style}
    >
      R{count}
    </span>
  );
}

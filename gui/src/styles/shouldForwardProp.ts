import isPropValid from "@emotion/is-prop-valid";

/**
 * styled-components 6 forwards every prop to the DOM, unlike v5 which only
 * forwarded valid HTML attributes. Restore the v5 behaviour so styling props
 * (e.g. `bordercolor`, `px`) stay off DOM elements; custom components still
 * receive all of their props.
 */
export function shouldForwardProp(prop: string, target: unknown): boolean {
  return typeof target === "string" ? isPropValid(prop) : true;
}

import Anser, { AnserJsonEntry } from "anser";
import { escapeCarriageReturn } from "escape-carriage";
import * as React from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "../../components";
import { getFontSize } from "../../util";

const AnsiSpan = styled.span<{
  bg?: string;
  fg?: string;
  decoration?: string;
}>`
  ${({ bg }) => bg && `background-color: rgb(${bg});`}
  ${({ fg }) => fg && `color: rgb(${fg});`}
  ${({ decoration }) => {
    switch (decoration) {
      case "bold":
        return "font-weight: bold;";
      case "dim":
        return "opacity: 0.5;";
      case "italic":
        return "font-style: italic;";
      case "hidden":
        return "visibility: hidden;";
      case "strikethrough":
        return "text-decoration: line-through;";
      case "underline":
        return "text-decoration: underline;";
      case "blink":
        return "text-decoration: blink;";
      default:
        return "";
    }
  }}
`;

const AnsiLink = styled.a`
  color: var(--vscode-textLink-foreground, #3794ff);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

// Using the same styled component structure as StyledMarkdown
const StyledAnsi = styled.div<{
  fontSize?: number;
  whiteSpace: string;
  bgColor: string;
}>`
  pre {
    white-space: ${(props) => props.whiteSpace};
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};
    border: 1px solid
      var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
    max-width: calc(100vw - 24px);
    overflow-x: scroll;
    overflow-y: hidden;
    padding: 8px;
  }

  code {
    span.line:empty {
      display: none;
    }
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
    font-size: ${getFontSize() - 2}px;
    font-family: var(--vscode-editor-font-family);
  }

  code:not(pre > code) {
    font-family: var(--vscode-editor-font-family);
    color: var(--vscode-input-placeholderForeground);
  }

  background-color: ${(props) => props.bgColor};
  font-family:
    var(--vscode-font-family),
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    "Open Sans",
    "Helvetica Neue",
    sans-serif;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  padding-left: 8px;
  padding-right: 8px;
  color: ${vscForeground};
  line-height: 1.5;

  > *:last-child {
    margin-bottom: 0;
  }
`;

/**
 * Converts ANSI strings into JSON output.
 * @name ansiToJSON
 * @function
 * @param {String} input The input string.
 * @param {boolean} use_classes If `true`, HTML classes will be appended
 *                              to the HTML output.
 * @return {Array} The parsed input.
 */
function ansiToJSON(
  input: string,
  use_classes: boolean = false,
): AnserJsonEntry[] {
  input = escapeCarriageReturn(fixBackspace(input));
  return Anser.ansiToJson(input, {
    json: true,
    remove_empty: true,
    use_classes,
  });
}

/**
 * Create a class string.
 * @name createClass
 * @function
 * @param {AnserJsonEntry} bundle
 * @return {String} class name(s)
 */
function createClass(bundle: AnserJsonEntry): string | null {
  let classNames: string = "";

  if (bundle.bg) {
    classNames += `${bundle.bg}-bg `;
  }
  if (bundle.fg) {
    classNames += `${bundle.fg}-fg `;
  }
  if (bundle.decoration) {
    classNames += `ansi-${bundle.decoration} `;
  }

  if (classNames === "") {
    return null;
  }

  classNames = classNames.substring(0, classNames.length - 1);
  return classNames;
}

/**
 * Converts an Anser bundle into a React Node.
 * @param linkify whether links should be converting into clickable anchor tags.
 * @param useClasses should render the span with a class instead of style.
 * @param bundle Anser output.
 * @param key
 */

function convertBundleIntoReact(
  linkify: boolean,
  useClasses: boolean,
  bundle: AnserJsonEntry,
  key: number,
): JSX.Element {
  const className = useClasses ? createClass(bundle) : null;
  // Convert bundle.decoration to string or undefined (not null) to match the prop type
  const decorationProp = bundle.decoration
    ? String(bundle.decoration)
    : undefined;

  if (!linkify) {
    return (
      <AnsiSpan
        key={key}
        className={className || undefined}
        bg={useClasses ? undefined : bundle.bg}
        fg={useClasses ? undefined : bundle.fg}
        decoration={decorationProp}
      >
        {bundle.content}
      </AnsiSpan>
    );
  }

  const content: React.ReactNode[] = [];
  const linkRegex =
    /(\s|^)(https?:\/\/(?:www\.|(?!www))[^\s.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/g;

  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(bundle.content)) !== null) {
    const [, pre, url] = match;

    const startIndex = match.index + pre.length;
    if (startIndex > index) {
      content.push(bundle.content.substring(index, startIndex));
    }

    // Make sure the href we generate from the link is fully qualified. We assume http
    // if it starts with a www because many sites don't support https
    const href = url.startsWith("www.") ? `http://${url}` : url;

    content.push(
      <AnsiLink key={index} href={href} target="_blank">
        {url}
      </AnsiLink>,
    );

    index = linkRegex.lastIndex;
  }

  if (index < bundle.content.length) {
    content.push(bundle.content.substring(index));
  }

  return (
    <AnsiSpan
      key={key}
      className={className || undefined}
      bg={useClasses ? undefined : bundle.bg}
      fg={useClasses ? undefined : bundle.fg}
      decoration={decorationProp}
    >
      {content}
    </AnsiSpan>
  );
}

declare interface Props {
  children?: string;
  linkify?: boolean;
  className?: string;
  useClasses?: boolean;
}

export default function Ansi(props: Props): JSX.Element {
  const { className, useClasses, children, linkify } = props;

  // Create the ANSI content
  const ansiContent = ansiToJSON(children ?? "", useClasses ?? false).map(
    (bundle, i) =>
      convertBundleIntoReact(linkify ?? false, useClasses ?? false, bundle, i),
  );

  return (
    <StyledAnsi
      contentEditable="false"
      fontSize={getFontSize()}
      whiteSpace="pre-wrap"
      bgColor={vscBackground}
    >
      <pre>
        <code className={className}>{ansiContent}</code>
      </pre>
    </StyledAnsi>
  );
}

// This is copied from the Jupyter Classic source code
// notebook/static/base/js/utils.js to handle \b in a way
// that is **compatible with Jupyter classic**.   One can
// argue that this behavior is questionable:
//   https://stackoverflow.com/questions/55440152/multiple-b-doesnt-work-as-expected-in-jupyter#
function fixBackspace(txt: string) {
  let tmp = txt;
  do {
    txt = tmp;
    // Cancel out anything-but-newline followed by backspace
    tmp = txt.replace(/[^\n]\x08/gm, "");
  } while (tmp.length < txt.length);
  return txt;
}

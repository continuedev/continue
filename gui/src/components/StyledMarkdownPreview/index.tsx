import { ctxItemToRifWithContents } from "core/commands/util";
import { memo, useEffect, useMemo, useRef } from "react";
import { useRemark } from "react-remark";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import styled from "styled-components";
import { visit } from "unist-util-visit";
import { v4 as uuidv4 } from "uuid";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { getContextItemsFromHistory } from "../../redux/thunks/updateFileSymbols";
import { getFontSize } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import FilenameLink from "./FilenameLink";
import "./katex.css";
import "./markdown.css";
import MermaidBlock from "./MermaidBlock";
import { rehypeHighlightPlugin } from "./rehypeHighlightPlugin";
import { SecureImageComponent } from "./SecureImageComponent";
import { StepContainerPreToolbar } from "./StepContainerPreToolbar";
import SymbolLink from "./SymbolLink";
import { SyntaxHighlightedPre } from "./SyntaxHighlightedPre";
import { isSymbolNotRif, matchCodeToSymbolOrFile } from "./utils";
import { fixDoubleDollarNewLineLatex } from "./utils/fixDoubleDollarLatex";
import { patchNestedMarkdown } from "./utils/patchNestedMarkdown";
import { remarkTables } from "./utils/remarkTables";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  whiteSpace: string;
  bgColor: string;
}>`
  h1 {
    font-size: 1.25em;
  }

  h2 {
    font-size: 1.15em;
  }

  h3 {
    font-size: 1.05em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.95em;
  }

  h6 {
    font-size: 0.9em;
  }

  pre {
    white-space: ${(props) => props.whiteSpace};
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

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
    border-radius: 0.3125rem;
    background-color: ${vscEditorBackground};
    font-size: ${getFontSize() - 2}px;
    font-family: var(--vscode-editor-font-family);
  }

  ul ul,
  ul ol,
  ol ul,
  ol ol {
    padding-left: 1.5em;
    margin-top: 1em;
  }

  li {
    margin-bottom: 0.8em;
  }
  li:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    padding-left: 2em;
  }

  code:not(pre > code) {
    font-family: var(--vscode-editor-font-family);
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

  p,
  li,
  ol,
  ul {
    line-height: 1.5;
  }

  * {
    word-break: break-word;
  }

  > *:last-child {
    margin-bottom: 0;
  }
`;

interface StyledMarkdownPreviewProps {
  showToolCallStatusIcon?: boolean;
  source?: string;
  className?: string;
  isRenderingInStepContainer?: boolean; // Currently only used to control the rendering of codeblocks
  scrollLocked?: boolean;
  itemIndex?: number;
  useParentBackgroundColor?: boolean;
  disableManualApply?: boolean;
  toolCallId?: string;
  expandCodeblocks?: boolean;
  collapsible?: boolean;
}

const HLJS_LANGUAGE_CLASSNAME_PREFIX = "language-";

function getLanguageFromClassName(className: any): string | null {
  if (!className || typeof className !== "string") {
    return null;
  }

  const language = className
    .split(" ")
    .find((word) => word.startsWith(HLJS_LANGUAGE_CLASSNAME_PREFIX))
    ?.split("-")[1];

  return language ?? null;
}

function getCodeChildrenContent(children: any) {
  if (typeof children === "string") {
    return children;
  } else if (
    Array.isArray(children) &&
    children.length > 0 &&
    typeof children[0] === "string"
  ) {
    return children[0];
  }
  return undefined;
}

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps,
) {
  // The refs are a workaround because rehype options are stored on initiation
  // So they won't use the most up-to-date state values
  // So in this case we just put them in refs

  // The logic here is to get file names from
  // 1. Context items found in past messages
  // 2. Toolbar Codeblocks found in past messages
  const history = useAppSelector((state) => state.session.history);
  const allSymbols = useAppSelector((state) => state.session.symbols);
  const pastFileInfo = useMemo(() => {
    const index = props.itemIndex;
    if (index === undefined) {
      return {
        symbols: [],
        rifs: [],
      };
    }
    const pastContextItems = getContextItemsFromHistory(history, index);
    const rifs = pastContextItems.map((item) =>
      ctxItemToRifWithContents(item, true),
    );
    const symbols = Object.entries(allSymbols)
      .filter((e) => pastContextItems.find((item) => item.uri!.value === e[0]))
      .map((f) => f[1])
      .flat();

    return {
      symbols,
      rifs,
    };
  }, [props.itemIndex, history, allSymbols]);
  const pastFileInfoRef = useUpdatingRef(pastFileInfo);
  const itemIndexRef = useUpdatingRef(props.itemIndex);

  const codeblockStreamIds = useRef<string[]>([]);

  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [
      remarkTables,
      [
        remarkMath,
        {
          singleDollarTextMath: false,
        },
      ],
      () => (tree: any) => {
        const lastNode = tree.children[tree.children.length - 1];
        const lastCodeNode = lastNode.type === "code" ? lastNode : null;

        visit(tree, "code", (node: any) => {
          if (!node.lang) {
            node.lang = "";
          } else if (node.lang.includes(".")) {
            node.lang = node.lang.split(".").slice(-1)[0];
          }

          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};

          node.data.hProperties["data-islastcodeblock"] = lastCodeNode === node;
          node.data.hProperties["data-codeblockcontent"] = node.value;

          if (node.meta) {
            let meta = node.meta.split(" ");
            node.data.hProperties["data-relativefilepath"] = meta[0];
            node.data.hProperties.range = meta[1];
          }
        });
      },
    ],
    rehypePlugins: [
      rehypeKatex as any,
      {},
      rehypeHighlightPlugin(),
      // Note: An empty obj is the default behavior, but leaving this here for scaffolding to
      // add unsupported languages in the future. We will need to install the `lowlight` package
      // to use the `common` language set in addition to unsupported languages.
      // https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
      () => {
        let codeBlockIndex = 0;
        return (tree) => {
          visit(tree, { tagName: "pre" }, (node: any) => {
            // Add an index (0, 1, 2, etc...) to each code block.
            node.properties = { "data-codeblockindex": codeBlockIndex };
            codeBlockIndex++;
          });
        };
      },
      {},
    ],
    rehypeReactOptions: {
      components: {
        a: ({ ...aProps }) => {
          return (
            <ToolTip place="top" className="m-0 p-0" content={aProps.href}>
              <a href={aProps.href} target="_blank" className="hover:underline">
                {aProps.children}
              </a>
            </ToolTip>
          );
        },
        pre: ({ ...preProps }) => {
          const codeBlockIndex = preProps["data-codeblockindex"];

          const preChildProps = preProps?.children?.[0]?.props ?? {};
          const { className, range } = preChildProps;

          const relativeFilePath = preChildProps["data-relativefilepath"];
          const codeBlockContent = preChildProps["data-codeblockcontent"];

          if (!props.isRenderingInStepContainer) {
            return <SyntaxHighlightedPre {...preProps} />;
          }

          const language = getLanguageFromClassName(className);

          const isLastCodeblock = preChildProps["data-islastcodeblock"];

          if (codeblockStreamIds.current[codeBlockIndex] === undefined) {
            codeblockStreamIds.current[codeBlockIndex] = uuidv4();
          }

          return (
            <StepContainerPreToolbar
              showToolCallStatusIcon={props.showToolCallStatusIcon}
              codeBlockContent={codeBlockContent}
              itemIndex={itemIndexRef.current}
              codeBlockIndex={codeBlockIndex}
              language={language}
              relativeFilepath={relativeFilePath}
              isLastCodeblock={isLastCodeblock}
              range={range}
              codeBlockStreamId={codeblockStreamIds.current[codeBlockIndex]} // ignored if toolCallId stream state is found
              forceToolCallId={props.toolCallId}
              expanded={props.expandCodeblocks}
              disableManualApply={props.disableManualApply}
              collapsible={props.collapsible}
            >
              <SyntaxHighlightedPre {...preProps} />
            </StepContainerPreToolbar>
          );
        },
        code: ({ ...codeProps }) => {
          const content = getCodeChildrenContent(codeProps.children);

          if (content) {
            const { symbols, rifs } = pastFileInfoRef.current;

            const matchedSymbolOrFile = matchCodeToSymbolOrFile(
              content,
              symbols,
              rifs,
            );
            if (matchedSymbolOrFile) {
              if (isSymbolNotRif(matchedSymbolOrFile)) {
                return (
                  <SymbolLink content={content} symbol={matchedSymbolOrFile} />
                );
              } else {
                return <FilenameLink rif={matchedSymbolOrFile} />;
              }
            }
          }
          if (codeProps.className?.includes("language-mermaid")) {
            const codeText = String(codeProps.children || "");
            return <MermaidBlock code={codeText} />;
          }
          return <code {...codeProps}>{codeProps.children}</code>;
        },
        img: ({ ...imgProps }) => {
          return (
            <SecureImageComponent
              src={imgProps.src}
              alt={imgProps.alt}
              title={imgProps.title}
              className={imgProps.className}
            />
          );
        },
      },
    },
  });

  useEffect(() => {
    setMarkdownSource(
      // some patches to source markdown are applied here:
      fixDoubleDollarNewLineLatex(patchNestedMarkdown(props.source ?? "")),
    );
  }, [props.source, allSymbols]);

  const uiConfig = useAppSelector(selectUIConfig);
  const codeWrapState = uiConfig?.codeWrap ? "pre-wrap" : "pre";

  return (
    <StyledMarkdown
      fontSize={getFontSize()}
      whiteSpace={codeWrapState}
      bgColor={props.useParentBackgroundColor ? "" : vscBackground}
    >
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;

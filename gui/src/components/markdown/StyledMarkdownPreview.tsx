import { ctxItemToRifWithContents } from "core/commands/util";
import { memo, useEffect, useMemo } from "react";
import { useRemark } from "react-remark";
import rehypeHighlight, { Options } from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import styled from "styled-components";
import { visit } from "unist-util-visit";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize, isJetBrains } from "../../util";
import FilenameLink from "./FilenameLink";
import "./katex.css";
import "./markdown.css";
import StepContainerPreActionButtons from "./StepContainerPreActionButtons";
import StepContainerPreToolbar from "./StepContainerPreToolbar";
import SymbolLink from "./SymbolLink";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { remarkTables } from "./utils/remarkTables";
import { SyntaxHighlightedPre } from "./SyntaxHighlightedPre";
import { patchNestedMarkdown } from "./utils/patchNestedMarkdown";
import { useAppSelector } from "../../redux/hooks";
import { fixDoubleDollarNewLineLatex } from "./utils/fixDoubleDollarLatex";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { ToolTip } from "../gui/Tooltip";
import { v4 as uuidv4 } from "uuid";
import { ContextItemWithId, RangeInFileWithContents } from "core";
import { getContextItemsFromHistory } from "../../redux/thunks/updateFileSymbols";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  whiteSpace: string;
}>`
  pre {
    white-space: ${(props) => props.whiteSpace};
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
    overflow-x: scroll;
    overflow-y: hidden;

    padding: 16px 8px;
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
    color: #f78383;
  }

  background-color: ${vscBackground};
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

  > *:first-child {
    margin-top: 8px;
  }

  > *:last-child {
    margin-bottom: 0;
  }
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  className?: string;
  isRenderingInStepContainer?: boolean; // Currently only used to control the rendering of codeblocks
  scrollLocked?: boolean;
  itemIndex?: number;
}

const HLJS_LANGUAGE_CLASSNAME_PREFIX = "language-";

function getLanuageFromClassName(className: any): string | null {
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
            node.lang = "javascript";
          } else if (node.lang.includes(".")) {
            node.lang = node.lang.split(".").slice(-1)[0];
          }

          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};

          node.data.hProperties["data-isgeneratingcodeblock"] =
            lastCodeNode === node;
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
      rehypeHighlight as any,
      // Note: An empty obj is the default behavior, but leaving this here for scaffolding to
      // add unsupported languages in the future. We will need to install the `lowlight` package
      // to use the `common` language set in addition to unsupported languages.
      // https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
      {
        // languages: {},
      } as Options,
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
          const tooltipId = uuidv4();

          return (
            <>
              <a
                href={aProps.href}
                target="_blank"
                className="hover:underline"
                data-tooltip-id={tooltipId}
              >
                {aProps.children}
              </a>
              <ToolTip id={tooltipId} place="top" className="m-0 p-0">
                {aProps.href}
              </ToolTip>
            </>
          );
        },
        pre: ({ ...preProps }) => {
          const codeBlockIndex = preProps["data-codeblockindex"];

          const preChildProps = preProps?.children?.[0]?.props ?? {};
          const { className, range } = preChildProps;
          const relativeFilePath = preChildProps["data-relativefilepath"];
          const codeBlockContent = preChildProps["data-codeblockcontent"];
          const isGeneratingCodeBlock =
            preChildProps["data-isgeneratingcodeblock"];

          if (!props.isRenderingInStepContainer) {
            return <SyntaxHighlightedPre {...preProps} />;
          }

          const language = getLanuageFromClassName(className);

          // If we don't have a filepath show the more basic toolbar
          // that is just action buttons on hover.
          // We also use this in JB since we haven't yet implemented
          // the logic forfileUri lazy apply.
          if (!relativeFilePath || isJetBrains()) {
            return (
              <StepContainerPreActionButtons
                language={language}
                codeBlockContent={codeBlockContent}
                codeBlockIndex={codeBlockIndex}
              >
                <SyntaxHighlightedPre {...preProps} />
              </StepContainerPreActionButtons>
            );
          }

          // We use a custom toolbar for codeblocks in the step container
          return (
            <StepContainerPreToolbar
              codeBlockContent={codeBlockContent}
              codeBlockIndex={codeBlockIndex}
              language={language}
              relativeFilepath={relativeFilePath}
              isGeneratingCodeBlock={isGeneratingCodeBlock}
              range={range}
            >
              <SyntaxHighlightedPre {...preProps} />
            </StepContainerPreToolbar>
          );
        },
        code: ({ ...codeProps }) => {
          const content = getCodeChildrenContent(codeProps.children);

          if (content) {
            const { symbols, rifs } = pastFileInfoRef.current;

            // Insert file links for matching previous context items
            // With some reasonable limitations on what might be a filename
            if (rifs.length && content.includes(".") && content.length > 2) {
              const match = rifs.find(
                (rif) => rif.filepath.split("/").pop() === content, // Exact match for last segment of URI
              );

              if (match) {
                return <FilenameLink rif={match} />;
              }
            }

            // Insert symbols for exact matches
            const exactSymbol = symbols.find((s) => s.name === content);
            if (exactSymbol) {
              return <SymbolLink content={content} symbol={exactSymbol} />;
            }

            // Partial matches - this is the case where the llm returns e.g. `subtract(number)` instead of `subtract`
            const partialSymbol = symbols.find((s) =>
              content.startsWith(s.name),
            );
            if (partialSymbol) {
              return <SymbolLink content={content} symbol={partialSymbol} />;
            }
          }
          return <code {...codeProps}>{codeProps.children}</code>;
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
    <StyledMarkdown fontSize={getFontSize()} whiteSpace={codeWrapState}>
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;

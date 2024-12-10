import { SymbolWithRange } from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { memo, useEffect, useMemo, useRef } from "react";
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

    margin: 10px 0;
    padding: 6px 8px;
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

function processCodeBlocks(tree: any) {
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

    node.data.hProperties["data-isgeneratingcodeblock"] = lastCodeNode === node;
    node.data.hProperties["data-codeblockcontent"] = node.value;

    if (node.meta) {
      let meta = node.meta.split(" ");
      node.data.hProperties.filepath = meta[0];
      node.data.hProperties.range = meta[1];
    }
  });
}

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps,
) {
  // The refs are a workaround because rehype options are stored on initiation
  // So they won't use the most up-to-date state values
  // So in this case we just put them in refs

  // Grab context items that are this one or further back
  const history = useAppSelector((state) => state.session.history);
  const previousFileContextItems = useMemo(() => {
    const index = props.itemIndex;
    if (index === undefined) {
      return [];
    }
    const previousItems = history.flatMap((item, i) =>
      i <= index ? item.contextItems : [],
    );
    return previousItems.filter(
      (item) => item.uri?.type === "file" && item?.uri?.value,
    );
  }, [props.itemIndex, history]);
  const previousFileContextItemsRef = useUpdatingRef(previousFileContextItems);

  // Extract global symbols for files matching previous context items
  const allSymbols = useAppSelector((state) => state.session.symbols);
  const previousFileContextItemSymbols = useMemo(() => {
    const uniqueUris = new Set(
      previousFileContextItems.map((item) => item.uri!.value!),
    );
    return Object.entries(allSymbols)
      .filter((e) => uniqueUris.has(e[0]))
      .map((f) => f[1])
      .flat();
  }, [allSymbols, previousFileContextItems]);
  const symbolsRef = useUpdatingRef(previousFileContextItemSymbols);

  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [
      remarkTables,
      [
        remarkMath,
        {
          singleDollarTextMath: false,
        },
      ],
      () => processCodeBlocks,
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
            node.properties = { codeBlockIndex };
            codeBlockIndex++;
          });
        };
      },
      {},
    ],
    rehypeReactOptions: {
      components: {
        a: ({ node, ...aProps }) => {
          return (
            <a {...aProps} target="_blank">
              {aProps.children}
            </a>
          );
        },
        pre: ({ node, ...preProps }) => {
          const preChildProps = preProps?.children?.[0]?.props;
          const { className, filepath, range } = preProps?.children?.[0]?.props;

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
          // the logic for lazy apply.
          if (!filepath || isJetBrains()) {
            return (
              <StepContainerPreActionButtons
                language={language}
                codeBlockContent={codeBlockContent}
                codeBlockIndex={preProps.codeBlockIndex}
              >
                <SyntaxHighlightedPre {...preProps} />
              </StepContainerPreActionButtons>
            );
          }

          // We use a custom toolbar for codeblocks in the step container
          return (
            <StepContainerPreToolbar
              codeBlockContent={codeBlockContent}
              codeBlockIndex={preProps.codeBlockIndex}
              language={language}
              filepath={filepath}
              isGeneratingCodeBlock={isGeneratingCodeBlock}
              range={range}
            >
              <SyntaxHighlightedPre {...preProps} />
            </StepContainerPreToolbar>
          );
        },
        code: ({ node, ...codeProps }) => {
          const content = getCodeChildrenContent(codeProps.children);

          if (content && previousFileContextItemsRef.current) {
            // Insert file links for matching previous context items
            const ctxItem = previousFileContextItemsRef.current.find((item) =>
              item.uri!.value!.includes(content),
            );
            if (ctxItem) {
              const rif = ctxItemToRifWithContents(ctxItem);
              return <FilenameLink rif={rif} />;
            }

            // Insert symbols for exact matches
            const exactSymbol = symbolsRef.current.find(
              (s) => s.name === content,
            );
            if (exactSymbol) {
              return <SymbolLink content={content} symbol={exactSymbol} />;
            }

            // Partial matches - this is the case where the llm returns e.g. `subtract(number)` instead of `subtract`
            const partialSymbol = symbolsRef.current.find((s) =>
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
    <StyledMarkdown fontSize={getFontSize()} whiteSpace={codeWrapState}>{reactContent}</StyledMarkdown>
  );
});

export default StyledMarkdownPreview;

import React, { memo, useEffect } from "react";
import { useRemark } from "react-remark";
import rehypeShikiji from "rehype-shikiji";
import styled from "styled-components";
import { visit } from "unist-util-visit";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
import PreWithToolbar from "./PreWithToolbar";
import "./markdown.css";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  maxHeight?: number;
  showBorder?: boolean;
}>`
  pre {
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
    overflow-x: scroll;

    font-size: 12px;

    ${(props) => {
      if (props.showBorder) {
        return `
          border: 0.5px solid #8888;
        `;
      }
    }}
    padding: ${(props) => (props.showBorder ? "12px" : "0px 2px")};
    ${(props) => {
      if (props.maxHeight) {
        return `
          max-height: ${props.maxHeight}px;
          overflow-y: auto;
        `;
      }
    }}
  }

  code {
    color: #f78383;
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
    font-size: 12px;
    font-family: var(--vscode-editor-font-family);
  }

  code:not(pre > code) {
    font-family: monospace;
  }

  background-color: ${vscBackground};
  font-family:
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
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  maxHeight?: number;
  className?: string;
  showCodeBorder?: boolean;
}

const FadeInWords: React.FC = (props: any) => {
  const { children, ...otherProps } = props;

  // Split the text into words
  const words = children
    .map((child) => {
      if (typeof child === "string") {
        return child.split(" ").map((word, index) => (
          <span className="fade-in-span" key={index}>
            {word}{" "}
          </span>
        ));
      } else {
        return <span className="fade-in-span">{child}</span>;
      }
    })
    .flat();

  return <p {...otherProps}>{words}</p>;
};

const supportedLanguages = [
  "abap",
  "actionscript-3",
  "ada",
  "apex",
  "applescript",
  "asm",
  "awk",
  "bat",
  "c",
  "clojure",
  "cobol",
  "coffee",
  "cpp",
  "crystal",
  "csharp",
  "css",
  "d",
  "dart",
  "diff",
  "dockerfile",
  "elixir",
  "elm",
  "erlang",
  // "fortran",
  "fsharp",
  "git-commit",
  "git-rebase",
  // "go",
  "graphql",
  "groovy",
  "hack",
  "haml",
  "handlebars",
  "haskell",
  "hcl",
  "hlsl",
  "html",
  "ini",
  "java",
  "javascript",
  "jinja-html",
  "json",
  "jsonc",
  "jsonnet",
  "jsx",
  "julia",
  "kotlin",
  "latex",
  "less",
  "lisp",
  "log",
  "logo",
  "lua",
  "makefile",
  "markdown",
  "matlab",
  "nix",
  "objective-c",
  "ocaml",
  "pascal",
  "perl",
  "perl6",
  "php",
  "pls",
  "postcss",
  "powershell",
  "prolog",
  "pug",
  "puppet",
  "purescript",
  "python",
  "r",
  "razor",
  "ruby",
  "rust",
  "sas",
  "sass",
  "scala",
  "scheme",
  "scss",
  "shaderlab",
  "shellscript",
  "smalltalk",
  "sql",
  "stylus",
  "svelte",
  "swift",
  "tcl",
  "toml",
  "ts",
  "tsx",
  "typescript",
  "vb",
  "viml",
  "vue",
  "wasm",
  "xml",
  "xsl",
  "yaml",
  "文言",
];

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps
) {
  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [
      () => {
        return (tree) => {
          visit(tree, "code", (node: any) => {
            if (!supportedLanguages.includes(node.lang)) {
              node.lang = "javascript"; // Default to javascript to get some highlighting
            }
          });
        };
      },
    ],
    rehypePlugins: [
      [
        rehypeShikiji as any,
        {
          theme:
            (window as any).fullColorTheme ||
            (window as any).colorThemeName ||
            "dark-plus",
          addLanguageClass: true,
        },
      ],
      // [
      //   rehypeWrapAll,
      //   {
      //     selector: "code > span",
      //     wrapper: "span.fade-in-span",
      //   },
      // ],
    ],
    rehypeReactOptions: {
      components: {
        a: ({ node, ...props }) => {
          return (
            <a {...props} target="_blank">
              {props.children}
            </a>
          );
        },
        pre: ({ node, ...preProps }) => {
          return props.showCodeBorder ? (
            <PreWithToolbar {...preProps}></PreWithToolbar>
          ) : (
            <pre {...preProps}></pre>
          );
        },
        // p: ({ node, ...props }) => {
        //   return <FadeInWords {...props}></FadeInWords>;
        // },
      },
    },
  });

  useEffect(() => {
    setMarkdownSource(props.source || "");
  }, [props.source]);

  return (
    <StyledMarkdown
      maxHeight={props.maxHeight}
      fontSize={getFontSize()}
      showBorder={props.showCodeBorder}
    >
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;

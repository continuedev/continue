/**
 * CodeRenderer is a class that, when given a code string,
 * highlights the code string using shiki and
 * returns a svg representation of it.
 * We could technically just call shiki's methods to do a
 * one-liner syntax highlighting code, but
 * a separate class for this is useful because
 * we rarely ever need syntax highlighting outside of
 * creating a render of it.
 */
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from "@shikijs/transformers";
import { JSDOM } from "jsdom";
import {
  BundledLanguage,
  BundledTheme,
  getSingletonHighlighter,
  Highlighter,
} from "shiki";
import { escapeForSVG, kebabOfStr } from "../util/text";

interface CodeRendererOptions {
  themesDir?: string;
  theme?: string;
}

interface HTMLOptions {
  theme?: string;
  customCSS?: string;
  containerClass?: string;
}

interface ConversionOptions extends HTMLOptions {
  transparent?: boolean;
  imageType: "svg";
}

interface Dimensions {
  width: number;
  height: number;
}

type DataUri = PngUri | SvgUri;
type PngUri = string;
type SvgUri = string;

export class CodeRenderer {
  private static instance: CodeRenderer;
  private currentTheme: string = "dark-plus";
  private editorBackground: string = "#000000";
  private editorForeground: string = "#FFFFFF";
  private editorLineHighlight: string = "#000000";
  private highlighter: Highlighter | null = null;

  private constructor() {}

  static getInstance(): CodeRenderer {
    if (!CodeRenderer.instance) {
      CodeRenderer.instance = new CodeRenderer();
    }
    return CodeRenderer.instance;
  }

  public async setTheme(themeName: string): Promise<void> {
    if (
      this.themeExists(kebabOfStr(themeName)) ||
      themeName === "Default Dark Modern"
    ) {
      this.currentTheme =
        themeName === "Default Dark Modern"
          ? "dark-plus"
          : kebabOfStr(themeName);

      this.highlighter = await getSingletonHighlighter({
        langs: ["typescript"],
        themes: [this.currentTheme],
      });

      const th = this.highlighter.getTheme(this.currentTheme);
      // const customTheme = {
      //   ...th,
      //   colors: {
      //     ...th.colors,
      //     // "editor.lineHighlightBackground": "#ffffff1a", // VS Code's highlight color
      //   },
      // };

      this.editorBackground = th.bg;
      this.editorForeground = th.fg;
      this.editorLineHighlight =
        th.colors!["editor.lineHighlightBackground"] ?? "#000000";
      console.log(th.colors);
    } else {
      this.currentTheme = "dark-plus";
    }
  }

  async init(): Promise<void> {}

  async close(): Promise<void> {}

  themeExists(themeNameKebab: string): themeNameKebab is BundledTheme {
    const themeArray: BundledTheme[] = [
      "andromeeda",
      "aurora-x",
      "ayu-dark",
      "catppuccin-frappe",
      "catppuccin-latte",
      "catppuccin-macchiato",
      "catppuccin-mocha",
      "dark-plus",
      "dracula",
      "dracula-soft",
      "everforest-dark",
      "everforest-light",
      "github-dark",
      "github-dark-default",
      "github-dark-dimmed",
      "github-dark-high-contrast",
      "github-light",
      "github-light-default",
      "github-light-high-contrast",
      "gruvbox-dark-hard",
      "gruvbox-dark-medium",
      "gruvbox-dark-soft",
      "gruvbox-light-hard",
      "gruvbox-light-medium",
      "gruvbox-light-soft",
      "houston",
      "kanagawa-dragon",
      "kanagawa-lotus",
      "kanagawa-wave",
      "laserwave",
      "light-plus",
      "material-theme",
      "material-theme-darker",
      "material-theme-lighter",
      "material-theme-ocean",
      "material-theme-palenight",
      "min-dark",
      "min-light",
      "monokai",
      "night-owl",
      "nord",
      "one-dark-pro",
      "one-light",
      "plastic",
      "poimandres",
      "red",
      "rose-pine",
      "rose-pine-dawn",
      "rose-pine-moon",
      "slack-dark",
      "slack-ochin",
      "snazzy-light",
      "solarized-dark",
      "solarized-light",
      "synthwave-84",
      "tokyo-night",
      "vesper",
      "vitesse-black",
      "vitesse-dark",
      "vitesse-light",
    ];

    return themeArray.includes(themeNameKebab as BundledTheme);
  }

  async highlightCode(
    code: string,
    language: string = "javascript",
    currLineOffsetFromTop: number,
  ): Promise<string> {
    const annotatedCode = code
      .split("\n")
      .map((line, i) =>
        i === currLineOffsetFromTop
          ? line + " \/\/ \[\!code highlight\]"
          : line,
      )
      .join("\n");

    await this.highlighter!.loadLanguage(language as BundledLanguage);

    return this.highlighter!.codeToHtml(annotatedCode, {
      lang: language,
      theme: this.currentTheme,
      transformers: [
        // transformerColorizedBrackets(),
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
      ],
      // decorations: [
      //   {
      //     start: { line: currLineOffsetFromTop, character: 0 },
      //     end: { line: currLineOffsetFromTop, character: 0 },
      //     properties: { class: "highlighted-line" },
      //   },
      // ],
    });
  }

  async convertToSVG(
    code: string,
    language: string = "javascript",
    fontSize: number,
    fontFamily: string,
    dimensions: Dimensions,
    lineHeight: number,
    options: ConversionOptions,
    currLineOffsetFromTop: number,
  ): Promise<Buffer> {
    const strokeWidth = 1;
    const highlightedCodeHtml = await this.highlightCode(
      code,
      language,
      currLineOffsetFromTop,
    );
    console.log(highlightedCodeHtml);

    const { guts, lineBackgrounds } = this.convertShikiHtmlToSvgGut(
      highlightedCodeHtml,
      fontSize,
      fontFamily,
      lineHeight,
    );
    const backgroundColor = this.getBackgroundColor(highlightedCodeHtml);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" shape-rendering="crispEdges">
  <g>
  <rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}" fill="${this.editorBackground}" shape-rendering="crispEdges" />
    ${lineBackgrounds}
    ${guts}
  </g>
</svg>`;
    console.log(svg);

    return Buffer.from(svg, "utf8");
  }

  convertShikiHtmlToSvgGut(
    shikiHtml: string,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
  ): { guts: string; lineBackgrounds: string } {
    const dom = new JSDOM(shikiHtml);
    const document = dom.window.document;

    const lines = Array.from(document.querySelectorAll(".line"));
    const svgLines = lines.map((line, index) => {
      const spans = Array.from(line.childNodes)
        .map((node) => {
          if (node.nodeType === 3) {
            return `<tspan xml:space="preserve">${escapeForSVG(node.textContent ?? "")}</tspan>`;
          }

          const el = node as HTMLElement;
          const style = el.getAttribute("style") || "";
          const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6})/);
          const classes = el.getAttribute("class") || "";
          let fill = colorMatch ? ` fill="${colorMatch[1]}"` : "";
          if (classes.includes("highlighted")) {
            fill = ` fill="${this.editorLineHighlight}"`;
          }
          const content = el.textContent || "";
          return `<tspan xml:space="preserve"${fill}>${escapeForSVG(content)}</tspan>`;
        })
        .join("");

      // Typography notes:
      // Each line of code is a <text> inside a <rect>.
      // Math becomes interesting here; the y value is actually aligned to the topmost border.
      // So y = 0 will have the rect be flush with the top border.
      // More importantly, text will also be positioned that way.
      // Since y = 0 is the axis the text will align itself to, the default settings will actually have the text sitting "on top of" the y = 0 axis, which effectively shifts them up.
      // To prevent this, we want the alignment axis to be at the middle of each rect, and have the text align itself vertically to the center (skwered by the axis).
      // The first step is to add lineHeight / 2 to move the axis down.
      // The second step is to add 'dominant-baseline="central"' to vertically center the text.
      // Note that we choose "central" over "middle". "middle" will center the text too perfectly, which is actually undesirable!
      const y = index * lineHeight + lineHeight / 2;
      return `<text x="0" y="${y}" font-family="${fontFamily}" font-size="${fontSize.toString()}" xml:space="preserve" dominant-baseline="central" shape-rendering="crispEdges">${spans}</text>`;
    });

    const lineBackgrounds = [...lines, null]
      .map((line, index) => {
        const classes = line?.getAttribute("class") || "";
        const bgColor = classes.includes("highlighted")
          ? this.editorLineHighlight
          : this.editorBackground;
        const y = index * lineHeight;
        // SVG notes:
        // By default SVGs have anti-aliasing on.
        // This is undesirable in our case because pixel-perfect alignment of these rectangles will introduce thin gaps.
        // Turning it off with 'shape-rendering="crispEdges"' solves the issue.
        return `<rect x="0" y="${y}" width="100%" height="${lineHeight}" fill="${bgColor}" shape-rendering="crispEdges" />`;
      })
      .join("\n");

    return {
      guts: svgLines.join("\n"),
      lineBackgrounds,
    };
  }

  getBackgroundColor(shikiHtml: string): string {
    const dom = new JSDOM(shikiHtml);
    const document = dom.window.document;

    const preElement = document.querySelector("pre");
    let backgroundColor = "#333333"; // Default white background
    if (preElement) {
      const style = preElement.getAttribute("style") || "";
      const bgColorMatch = style.match(/background-color:\s*(#[0-9a-fA-F]{6})/);
      if (bgColorMatch) {
        backgroundColor = bgColorMatch[1];
      }
    }

    return backgroundColor;
  }

  async getDataUri(
    code: string,
    language: string = "javascript",
    fontSize: number,
    fontFamily: string,
    dimensions: Dimensions,
    lineHeight: number,
    options: ConversionOptions,
    currLineOffsetFromTop: number,
  ): Promise<DataUri> {
    switch (options.imageType) {
      // case "png":
      //   const pngBuffer = await this.convertToPNG(
      //     code,
      //     language,
      //     fontSize,
      //     dimensions,
      //     lineHeight,
      //     options,
      //   );
      //   return `data:image/png;base64,${pngBuffer.data.toString("base64")}`;
      case "svg":
        const svgBuffer = await this.convertToSVG(
          code,
          language,
          fontSize,
          fontFamily,
          dimensions,
          lineHeight,
          options,
          currLineOffsetFromTop,
        );
        return `data:image/svg+xml;base64,${svgBuffer.toString("base64")}`;
    }
  }
}

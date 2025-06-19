import * as fs from "fs/promises";
import { JSDOM } from "jsdom";
import path from "path";
import puppeteer, { Browser, ScreenshotOptions } from "puppeteer";
import { BundledTheme, codeToHtml } from "shiki";
import { kebabOfStr } from "../util/text";

interface SyntaxHighlighterOptions {
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
  screenshotOptions?: ScreenshotOptions;
  imageType: "png" | "svg";
}

interface Dimensions {
  width: number;
  height: number;
}

interface DataAndDimensions {
  data: Buffer;
  dimensions: Dimensions;
}

interface DataUriAndDimensions {
  uri: DataUri;
  dimensions: Dimensions;
}

type DataUri = PngUri | SvgUri;

type PngUri = string;
type SvgUri = string;

export class SyntaxHighlighter {
  private themesDir: string = path.join(__dirname, "themes"); // We may need this in case we start supporting custom colors.
  private currentTheme: string;
  private browser: Browser | undefined = undefined;
  private static instance: SyntaxHighlighter;

  private constructor(options: SyntaxHighlighterOptions = {}) {
    this.currentTheme = options.theme || "dark-plus";
  }

  static getInstance(options?: SyntaxHighlighterOptions): SyntaxHighlighter {
    if (!SyntaxHighlighter.instance) {
      SyntaxHighlighter.instance = new SyntaxHighlighter(options);
    }
    return SyntaxHighlighter.instance;
  }

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }

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

  async setTheme(themeName: string): Promise<void> {
    if (this.themeExists(kebabOfStr(themeName))) {
      this.currentTheme = themeName;
    } else {
      this.currentTheme = "dark-plus";
    }
  }

  async highlightCode(
    code: string,
    language: string = "javascript",
  ): Promise<string> {
    return await codeToHtml(code, {
      lang: language,
      theme: this.currentTheme,
    });
  }

  async convertToPNG(
    code: string,
    language: string = "javascript",
    fontSize: number,
    options: ConversionOptions,
  ): Promise<DataAndDimensions> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const highlightedCodeHtml = await this.highlightCode(code, language);

    const page = await this.browser.newPage();
    await page.setContent(highlightedCodeHtml);

    const dimensions = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.scrollWidth,
        height: body.scrollHeight,
      };
    });

    await page.setViewport({
      width: 3840,
      height: 2160,
      deviceScaleFactor: 1,
    });

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
      ...options.screenshotOptions,
    });

    await page.close();

    return { data: screenshot, dimensions: dimensions };
  }

  async convertToSVG(
    code: string,
    language: string = "javascript",
    fontSize: number,
    options: ConversionOptions,
  ): Promise<DataAndDimensions> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const highlightedCodeHtml = await this.highlightCode(code, language);

    console.log(code);
    console.log(highlightedCodeHtml);

    const guts = this.convertShikiHtmlToSvgGut(highlightedCodeHtml, fontSize);
    const backgroundColor = this.getBackgroundColor(highlightedCodeHtml);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  ${guts}
</svg>`;

    const tempPage = await this.browser.newPage();
    await tempPage.setContent(svg);

    const dimensions = await tempPage.evaluate(() => {
      const svg = document.querySelector("svg");
      if (!svg) return { width: 0, height: 0 };
      const bbox = svg.getBBox();
      return {
        width: Math.ceil(bbox.width),
        height: Math.ceil(bbox.height),
      };
    });

    await tempPage.close();

    const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}">
  <g><rect width="${dimensions.width}" height="${dimensions.height}" fill="${backgroundColor}" />${guts}</g>
</svg>`;

    console.log(finalSvg);
    return { data: Buffer.from(finalSvg, "utf8"), dimensions: dimensions };
  }

  convertShikiHtmlToSvgGut(shikiHtml: string, fontSize: number): string {
    const dom = new JSDOM(shikiHtml);
    const document = dom.window.document;

    const lines = Array.from(document.querySelectorAll(".line"));
    const svgLines = lines.map((line, index) => {
      const spans = Array.from(line.childNodes)
        .map((node) => {
          if (node.nodeType === 3) {
            return `<tspan xml:space="preserve">${node.textContent}</tspan>`;
          }

          const el = node as HTMLElement;
          const style = el.getAttribute("style") || "";
          const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6})/);
          const fill = colorMatch ? ` fill="${colorMatch[1]}"` : "";
          const content = el.textContent || "";
          return `<tspan xml:space="preserve"${fill}>${content}</tspan>`;
        })
        .join("");

      const y = index * 20 + fontSize; // 20px line height
      return `<text x="0" y="${y}" font-family="monospace" font-size="${fontSize.toString()}" xml:space="preserve">${spans}</text>`;
    });

    return `
  ${svgLines.join("\n")}
  `.trim();
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
    options: ConversionOptions,
  ): Promise<DataUri> {
    switch (options.imageType) {
      case "png":
        const pngBuffer = await this.convertToPNG(
          code,
          language,
          fontSize,
          options,
        );
        return `data:image/png;base64,${pngBuffer.data.toString("base64")}`;
      case "svg":
        const svgBuffer = await this.convertToSVG(
          code,
          language,
          fontSize,
          options,
        );
        return `data:image/svg+xml;base64,${svgBuffer.data.toString("base64")}`;
    }
  }

  async getDataUriAndDimensions(
    code: string,
    language: string = "javascript",
    fontSize: number,
    options: ConversionOptions,
  ): Promise<DataUriAndDimensions> {
    const converters: {
      [Key in "png" | "svg"]: (
        code: string,
        language: string,
        fontSize: number,
        options: ConversionOptions,
      ) => Promise<DataAndDimensions>;
    } = {
      png: this.convertToPNG.bind(this),
      svg: this.convertToSVG.bind(this),
    };

    const mimetypes: {
      [Key in "png" | "svg"]: string;
    } = {
      png: "image/png",
      svg: "image/svg+xml",
    };

    const { data, dimensions } = await converters[options.imageType](
      code,
      language,
      fontSize,
      options,
    );

    return {
      uri: `data:${mimetypes[options.imageType]};base64,${data.toString("base64")}`,
      dimensions: dimensions,
    };
  }

  // Utility method to list available themes
  async getAvailableThemes(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.themesDir);
      return files
        .filter((file) => file.endsWith(".css"))
        .map((file) => file.replace(".css", ""));
    } catch (error) {
      return [];
    }
  }
}

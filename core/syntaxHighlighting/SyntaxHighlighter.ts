import * as fs from "fs/promises";
import { JSDOM } from "jsdom";
import path from "path";
import satori from "satori";
// import puppeteer, { Browser, ScreenshotOptions } from "puppeteer";
import { BundledTheme, codeToHtml } from "shiki";
import { escapeForSVG, kebabOfStr } from "../util/text";

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
  imageType: "svg";
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

  // async convertToPNG(
  //   code: string,
  //   language: string = "javascript",
  //   fontSize: number,
  //   dimensions: Dimensions,
  //   lineHeight: number,
  //   options: ConversionOptions,
  // ): Promise<DataAndDimensions> {
  //   if (!this.browser) {
  //     throw new Error("Browser not initialized. Call init() first.");
  //   }

  //   const highlightedCodeHtml = await this.highlightCode(code, language);

  //   const page = await this.browser.newPage();
  //   await page.setContent(highlightedCodeHtml);

  //   const dims = await page.evaluate(() => {
  //     const body = document.body;
  //     return {
  //       width: body.scrollWidth,
  //       height: body.scrollHeight,
  //     };
  //   });

  //   await page.setViewport({
  //     width: 3840,
  //     height: 2160,
  //     deviceScaleFactor: 1,
  //   });

  //   const screenshot = await page.screenshot({
  //     type: "png",
  //     omitBackground: true,
  //     ...options.screenshotOptions,
  //   });

  //   await page.close();

  //   return { data: screenshot, dimensions: dims };
  // }

  async convertToBlankSVG(
    dimensions: Dimensions,
    options: ConversionOptions,
  ): Promise<Buffer> {
    //     const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    //   ${guts}
    // </svg>`;

    // const tempPage = await this.browser.newPage();
    // await tempPage.setContent(svg);

    // const dimensions = await tempPage.evaluate(() => {
    //   const svg = document.querySelector("svg");
    //   if (!svg) return { width: 0, height: 0 };
    //   const bbox = svg.getBBox();
    //   return {
    //     width: Math.ceil(bbox.width),
    //     height: Math.ceil(bbox.height),
    //   };
    // });

    // await tempPage.close();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}">
  <g><rect width="${dimensions.width}" height="${dimensions.height}" fill="#ff0000" /><text fill="#ffffff" x="0" y="20" font-family="monospace" font-size="14" xml:space="preserve">TEST TEXT THIS IS</text></g>
</svg>`;

    console.log(svg);
    return Buffer.from(svg, "utf8");
  }

  async convertToSVG(
    code: string,
    language: string = "javascript",
    fontSize: number,
    dimensions: Dimensions,
    lineHeight: number,
    options: ConversionOptions,
  ): Promise<Buffer> {
    const highlightedCodeHtml = await this.highlightCode(code, language);

    // console.log(code);
    // console.log(highlightedCodeHtml);

    const guts = this.convertShikiHtmlToSvgGut(
      highlightedCodeHtml,
      fontSize,
      lineHeight,
    );
    const backgroundColor = this.getBackgroundColor(highlightedCodeHtml);
    //     const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    //   ${guts}
    // </svg>`;

    // const tempPage = await this.browser.newPage();
    // await tempPage.setContent(svg);

    // const dimensions = await tempPage.evaluate(() => {
    //   const svg = document.querySelector("svg");
    //   if (!svg) return { width: 0, height: 0 };
    //   const bbox = svg.getBBox();
    //   return {
    //     width: Math.ceil(bbox.width),
    //     height: Math.ceil(bbox.height),
    //   };
    // });

    // await tempPage.close();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}">
  <g><rect width="${dimensions.width}" height="${dimensions.height}" fill="${backgroundColor}" />${guts}</g>
</svg>`;

    console.log(svg);
    return Buffer.from(svg, "utf8");
  }

  async convertToSVGWithSatori(
    code: string,
    language: string = "javascript",
    fontSize: number,
    dimensions: Dimensions,
    lineHeight: number,
    options: ConversionOptions,
  ): Promise<Buffer> {
    const highlightedCodeHtml = await this.highlightCode(code, language);

    console.log(code);
    console.log(highlightedCodeHtml);

    // Convert to SVG using Satori
    const fontData = await this.loadFont();
    const svg = await satori(highlightedCodeHtml, {
      width: dimensions.width, // You'll need to determine appropriate width
      height: dimensions.height, // Dynamic height based on content
      fonts: [
        {
          name: "YourMonospaceFontName",
          data: fontData,
          style: "normal",
        },
      ],
    });

    console.log(svg);
    return Buffer.from(svg, "utf8");
  }

  // Function to load your font
  async loadFont(): Promise<Buffer> {
    // Option 1: If running in Node.js, you can load from the filesystem
    console.log(process.cwd());
    return Buffer.from(
      await fs.readFile(
        "/home/jacob/continue/continue/fonts/Cascadia_Mono/static/CascadiaMono-Regular.ttf",
        "binary",
      ),
      "binary",
    );
  }

  convertShikiHtmlToSvgGut(
    shikiHtml: string,
    fontSize: number,
    lineHeight: number,
  ): string {
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
          const fill = colorMatch ? ` fill="${colorMatch[1]}"` : "";
          const content = el.textContent || "";
          return `<tspan xml:space="preserve"${fill}>${escapeForSVG(content)}</tspan>`;
        })
        .join("");

      const y = (index + 1) * lineHeight;
      // const y = index * lineHeight;
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
    dimensions: Dimensions,
    lineHeight: number,
    options: ConversionOptions,
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
          dimensions,
          lineHeight,
          options,
        );
        return `data:image/svg+xml;base64,${svgBuffer.toString("base64")}`;
    }
  }

  async getBlankDataUri(
    dimensions: Dimensions,
    options: ConversionOptions,
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
        const svgBuffer = await this.convertToBlankSVG(dimensions, options);
        return `data:image/svg+xml;base64,${svgBuffer.toString("base64")}`;
    }
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

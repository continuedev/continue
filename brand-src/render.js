// Render every Continued brand asset from the SVG sources in brand-src/.
// Uses sharp (installed in core/). Run from the repository root:
//   node brand-src/render.js
const path = require("path");
const fs = require("fs");
const sharp = require(
  path.join(__dirname, "..", "core", "node_modules", "sharp"),
);

const ROOT = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(__dirname, name));
const MARK = read("mark.svg");
const SMALL = read("mark-small.svg");
const MONO = read("mark-mono.svg");

// [destination, size, source]. Sizes <= 48px use the small-size variant so the
// glyph stays crisp instead of being a blurry downscale of the large mark.
const pngTargets = [
  // VS Code extension icon (Marketplace requires >= 128px)
  ["extensions/vscode/media/icon.png", 256, MARK],
  // Docs favicon and GUI logo
  ["docs/favicon.png", 128, MARK],
  ["gui/public/logos/continued.png", 256, MARK],
  // Browser / webview favicons
  ["gui/public/favicon-32.png", 32, SMALL],
  ["gui/public/apple-touch-icon.png", 180, MARK],
];

// Straight copies of the SVG sources.
const svgTargets = [
  // Activity-bar icon: monochrome so VS Code can theme it
  ["extensions/vscode/media/sidebar-icon.svg", MONO],
  ["gui/public/favicon.svg", SMALL],
  ["docs/logo/light.svg", MARK],
  ["docs/logo/dark.svg", MARK],
  // JetBrains marketplace / plugin list icons
  ["extensions/intellij/src/main/resources/META-INF/pluginIcon.svg", MARK],
  ["extensions/intellij/src/main/resources/META-INF/pluginIcon_dark.svg", MARK],
];

const write = (rel, data) => {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
};

async function main() {
  for (const [rel, size, svg] of pngTargets) {
    const buf = await sharp(svg, { density: 384 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    write(rel, buf);
    console.log(`wrote ${rel} (${size}px)`);
  }

  for (const [rel, svg] of svgTargets) {
    write(rel, svg);
    console.log(`wrote ${rel}`);
  }

  // Multi-size ICO: PNG-compressed frames inside an ICO container.
  const sizes = [16, 32, 48, 64, 128, 256];
  const frames = await Promise.all(
    sizes.map((s) =>
      sharp(s <= 48 ? SMALL : MARK, { density: 384 })
        .resize(s, s)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    ),
  );
  write("gui/public/favicon.ico", buildIco(sizes, frames));
  console.log("wrote gui/public/favicon.ico");
}

// ICO container with PNG frames (Windows Vista+ format).
function buildIco(sizes, pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length);
  let offset = 6 + dir.length;
  sizes.forEach((s, i) => {
    const o = i * 16;
    dir.writeUInt8(s >= 256 ? 0 : s, o); // width (0 = 256)
    dir.writeUInt8(s >= 256 ? 0 : s, o + 1); // height
    dir.writeUInt8(0, o + 2); // palette
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(pngs[i].length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += pngs[i].length;
  });
  return Buffer.concat([header, dir, ...pngs]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

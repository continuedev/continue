// Rename the product "Continue" to "Continuous" in docs/ prose.
// Leaves code (fenced blocks and inline `code`), URLs, and identifiers
// (Continue.continue, .continue/, continue.*, @continuedev) alone, and
// skips "Continue" used as a verb ("Continue to the next step").
//
//   node scripts/rename-docs-product.js           # report
//   node scripts/rename-docs-product.js --write   # rewrite
const fs = require("fs");
const path = require("path");

const DOCS = path.join(__dirname, "..", "docs");
const WRITE = process.argv.includes("--write");
const VERBOSE = process.argv.includes("--verbose");

// The product name as a whole word: not part of a path/URL/identifier.
// Not "Continue Dev, Inc." (the company), which attribution must keep.
const PRODUCT =
  /(?<![\w./@:#-])Continue(?![\w-])(?!\.(?:[a-z]|continue))(?! Dev\b)/g;
// The fork's own pages, which refer to upstream on purpose.
const SKIP_FILES = new Set(["continuous-install.md", "README.md"]);
// Verb uses: "Continue to/with/on/reading/..." at a sentence or item start.
const VERB_AFTER =
  /^\s+(to|with|on|reading|working|the|through|until|as|if|when|by|clicking|from|button)\b/i;
const URLISH = /https?:\/\/\S*$/;

function* files(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "images") continue;
      yield* files(p);
    } else if (/\.(mdx|md)$/.test(name) && !SKIP_FILES.has(name)) {
      yield p;
    }
  }
}

/** Apply fn to the prose parts of a markdown line (outside `inline code`). */
function mapProse(line, fn) {
  return line
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith("`") ? part : fn(part)))
    .join("");
}

let total = 0;
let verbs = 0;
for (const file of files(DOCS)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let inFence = false;
  let count = 0;
  const out = lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return mapProse(line, (text) =>
      text.replace(PRODUCT, (m, offset) => {
        const before = text.slice(0, offset);
        if (URLISH.test(before)) return m;
        const after = text.slice(offset + m.length);
        const atStart = /(^|[.!?:]\s+|^\s*[-*\d.]+\s+|>\s*)$/.test(before);
        if (atStart && VERB_AFTER.test(after)) {
          verbs++;
          if (VERBOSE)
            console.log(
              `  verb kept: ${path.relative(DOCS, file)}: ${m}${after.slice(0, 30)}`,
            );
          return m;
        }
        count++;
        return "Continuous";
      }),
    );
  });
  if (count) {
    total += count;
    if (VERBOSE) console.log(`${count}\t${path.relative(DOCS, file)}`);
    if (WRITE) fs.writeFileSync(file, out.join("\n"));
  }
}
console.log(
  `${WRITE ? "renamed" : "would rename"} ${total}; kept ${verbs} verb use(s)`,
);

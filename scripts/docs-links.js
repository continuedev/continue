// Point links at docs.continue.dev to this fork's docs on GitHub.
//
// docs.continue.dev is upstream's (Continue-branded) site. The same pages live
// in docs/ here, so each URL is resolved through docs/docs.json's redirects to
// a docs/*.mdx file and rewritten to its GitHub URL. A URL whose page does not
// exist here is reported and left alone, so nothing points at a 404.
//
//   node scripts/docs-links.js           # report what would change
//   node scripts/docs-links.js --write   # rewrite the files
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
// The hosted docs site (GitHub Pages, built from docs/ by docs-site/).
const SITE = "https://b1tninja.github.io/continuous";
// Earlier links pointed at the page sources on GitHub; those are moved to the
// site too. A page that is not .mdx (the install guide) is not on the site
// and keeps its GitHub link.
const GITHUB_DOCS = "https://github.com/b1tninja/continuous/blob/main/docs";
const WRITE = process.argv.includes("--write");

// Shipped code only: the extension, the GUI, core and the packages it bundles.
const SCAN = [
  "core",
  "gui/src",
  "extensions/vscode/src",
  "extensions/vscode/package.json",
  "packages/config-yaml/src",
  "packages/openai-adapters/src",
  "packages/llm-info/src",
];
const SKIP_DIRS = new Set(["node_modules", "dist", "out", "build", ".git"]);
const EXTS = new Set([".ts", ".tsx", ".js", ".json", ".md"]);

const redirects = new Map(
  JSON.parse(
    fs.readFileSync(path.join(DOCS, "docs.json"), "utf8"),
  ).redirects.map((r) => [
    r.source.replace(/\/$/, "").toLowerCase(),
    r.destination,
  ]),
);

// Old URLs that docs.json does not redirect, to the page (and heading) that
// replaced them.
const LEGACY = new Map([
  [
    "/reference/model providers/moonshot",
    ["customize/model-providers/more/moonshot.mdx"],
  ],
  [
    "/reference/model providers/azure",
    ["customize/model-providers/top-level/azure.mdx"],
  ],
  [
    "/reference/model providers/openai",
    [
      "customize/model-providers/top-level/openai.mdx",
      "openai-api-compatible-providers",
    ],
  ],
  [
    "/customize/context-providers#jira-datacenter-support",
    ["reference/deprecated-context-providers.mdx", "jira-datacenter-support"],
  ],
]);

/** Site URL for a docs/ file (`customize/overview.mdx` -> /customize/overview). */
function siteUrl(page, anchor) {
  const p = page.replace(/\.mdx$/, "").replace(/(^|\/)index$/, "");
  return `${SITE}/${p}${anchor ? `#${anchor}` : ""}`;
}

/** docs/ file for a site path, or undefined. */
function pageFor(sitePath) {
  let p = decodeURIComponent(sitePath).replace(/\/$/, "") || "/";
  for (let hops = 0; hops < 10; hops++) {
    const next = redirects.get(p.toLowerCase());
    if (!next) break;
    if (/^https?:/.test(next)) return undefined; // redirects off-site
    p = next.replace(/\/$/, "");
  }
  const rel = p === "/" || p === "" ? "index" : p.replace(/^\//, "");
  for (const candidate of [`${rel}.mdx`, `${rel}.md`, `${rel}/index.mdx`]) {
    const file = path.join(DOCS, candidate);
    if (fs.existsSync(file)) return candidate;
  }
  return undefined;
}

function* walk(p) {
  const stat = fs.statSync(p);
  if (stat.isFile()) {
    if (EXTS.has(path.extname(p))) yield p;
    return;
  }
  for (const name of fs.readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue;
    yield* walk(path.join(p, name));
  }
}

const GITHUB_RE =
  /https:\/\/github\.com\/b1tninja\/continued\/blob\/main\/docs\/([^\s"'`)#\]<>\\]+\.mdx)(?:#([^\s"'`)\]<>\\]+))?/g;
const URL_RE = /https?:\/\/docs\.continue\.dev(\/[^\s"'`)\]<>\\]*)?/g;
let changed = 0;
const missing = new Map();
for (const target of SCAN) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const before = fs.readFileSync(file, "utf8");
    const after = before
      .replace(GITHUB_RE, (url, page, anchor) =>
        fs.existsSync(path.join(DOCS, page))
          ? (changed++, siteUrl(page, anchor))
          : url,
      )
      .replace(URL_RE, (url, rest = "/") => {
        let [pathPart, anchor] = rest.split("#");
        const key = decodeURIComponent(pathPart)
          .replace(/\/$/, "")
          .toLowerCase();
        const legacy =
          LEGACY.get(anchor ? `${key}#${anchor}` : key) ?? LEGACY.get(key);
        if (legacy) {
          changed++;
          const [page, newAnchor] = legacy;
          anchor = newAnchor ?? anchor;
          return siteUrl(page, anchor);
        }
        const page = pageFor(pathPart.replace(/\?.*$/, ""));
        if (!page) {
          const rel = path.relative(ROOT, file);
          missing.set(url, [...(missing.get(url) ?? []), rel]);
          return url;
        }
        changed++;
        return siteUrl(page, anchor);
      });
    if (after !== before && WRITE) fs.writeFileSync(file, after);
  }
}
console.log(`${WRITE ? "rewrote" : "would rewrite"} ${changed} link(s)`);
for (const [url, files] of missing) {
  console.log(`no page for ${url}\n    in ${[...new Set(files)].join(", ")}`);
}
process.exitCode = missing.size > 0 && WRITE ? 1 : 0;

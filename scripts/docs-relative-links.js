// Make the docs readable on GitHub: rewrite site-absolute links and images
// (`/customize/overview`, `/images/x.png`, as the docs site expects) into
// paths relative to each page (`../overview.mdx`, `../../images/x.png`).
// GitHub resolves `/...` from the repository root, so the absolute forms are
// 404s there. Links are resolved through docs.json's redirects; anything that
// does not resolve to a file is reported and left as it was.
//
//   node scripts/docs-relative-links.js           # report
//   node scripts/docs-relative-links.js --write   # rewrite
const fs = require("fs");
const path = require("path");

const DOCS = path.join(__dirname, "..", "docs");
const WRITE = process.argv.includes("--write");

const redirects = new Map(
  JSON.parse(
    fs.readFileSync(path.join(DOCS, "docs.json"), "utf8"),
  ).redirects.map((r) => [
    r.source.replace(/\/$/, "").toLowerCase(),
    r.destination,
  ]),
);

/** docs/-relative file for a site path, or undefined. */
function resolveSitePath(sitePath) {
  let p = decodeURIComponent(sitePath).replace(/\/$/, "") || "/";
  for (let hops = 0; hops < 10; hops++) {
    const next = redirects.get(p.toLowerCase());
    if (!next) break;
    if (/^https?:/.test(next)) return { external: next };
    p = next.replace(/\/$/, "");
  }
  const rel = p === "/" ? "index" : p.replace(/^\//, "");
  for (const c of [rel, `${rel}.mdx`, `${rel}.md`, `${rel}/index.mdx`]) {
    const f = path.join(DOCS, c);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return { file: c };
  }
  return undefined;
}

function* pages(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== "node_modules" && name !== "images") yield* pages(p);
    } else if (name.endsWith(".mdx")) {
      yield p;
    }
  }
}

// ](/x), href="/x", src="/x"
const LINK = /(\]\(|(?:href|src)=")(\/[^)"\s#]*)(#[^)"\s]*)?/g;
let rewritten = 0;
const unresolved = [];
for (const file of pages(DOCS)) {
  const before = fs.readFileSync(file, "utf8");
  let inFence = false;
  const after = before
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      return line.replace(LINK, (m, lead, sitePath, anchor = "") => {
        if (sitePath.startsWith("//")) return m; // protocol-relative URL
        const hit = resolveSitePath(sitePath);
        if (!hit) {
          unresolved.push(`${path.relative(DOCS, file)}: ${sitePath}`);
          return m;
        }
        rewritten++;
        if (hit.external) return `${lead}${hit.external}${anchor}`;
        let rel = path.relative(path.dirname(file), path.join(DOCS, hit.file));
        if (!rel.startsWith(".")) rel = `./${rel}`;
        return `${lead}${rel.split(path.sep).join("/")}${anchor}`;
      });
    })
    .join("\n");
  if (after !== before && WRITE) fs.writeFileSync(file, after);
}
console.log(`${WRITE ? "rewrote" : "would rewrite"} ${rewritten} link(s)`);
for (const u of unresolved) console.log(`  unresolved: ${u}`);

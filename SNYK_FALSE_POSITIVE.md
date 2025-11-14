# Snyk False Positive: Next.js Vulnerability

## Issue

Snyk reported a critical vulnerability (SNYK-JS-NEXT-9508709) in Next.js affecting `docs/package.json`.

## Analysis

This is a **false positive** for the following reasons:

1. **Next.js is not a direct dependency**: The `docs/package.json` only includes `mintlify` and `@c15t/react` as dependencies.

2. **Next.js is not installed**: Running `npm ls next` shows no Next.js installation in the project.

3. **No peer dependency requirement**: While `next-mdx-remote-client` (a transitive dependency of `@mintlify/common`) previously had Next.js references, it does not require Next.js as a peer dependency.

## Verification

```bash
$ cd docs && npm ls next
docs2@1.0.0 /home/user/continue/docs
└── (empty)
```

## Recommendation

This Snyk alert can be safely ignored or marked as a false positive. The docs project does not use Next.js and is not vulnerable to this issue.

## Related CVE

- CVE ID: SNYK-JS-NEXT-9508709
- Severity: Critical (CVSS 8.5)
- Issue Type: Improper Authorization
- Affected versions: >=11.1.4 <12.3.5, >=13.0.0 <13.5.9, >=14.0.0 <14.2.25, >=15.0.0-rc.0 <15.2.3, >=15.3.0-canary.0 <15.3.0-canary.12

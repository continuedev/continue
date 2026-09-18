# vercel-optimize

Optimize cost and performance for supported projects on Vercel.

This skill uses Vercel metrics to find high-impact improvements in your app. Every recommendation is backed by observed data, scoped code evidence, and version-aware docs.

[![skills.sh](https://skills.sh/b/vercel-labs/agent-skills)](https://skills.sh/vercel-labs/agent-skills)

## Install

Install just this skill:

```bash
npx skills add vercel-labs/agent-skills --skill vercel-optimize
```

Manual install: copy `skills/vercel-optimize` into `.agents/skills/vercel-optimize` and reference `SKILL.md` from your project `AGENTS.md`.

## Requirements

- Node.js 20+
- Vercel CLI with `vercel metrics`, `vercel usage`, `vercel contract`, and `vercel api` support (`npm i -g vercel@latest`). The skill enforces v53+ as its compatibility floor.
- Authenticated Vercel CLI session (`vercel login`)
- Linked Vercel project directory (`vercel link`) for route metrics. `VERCEL_PROJECT_ID` can resolve project config, but it does not replace directory linkage for `vercel metrics`. The project must resolve to a CLI-safe team or personal scope so `vercel metrics`, `vercel usage`, and `vercel contract` all run against the same account.
- Observability Plus for metric-backed route ranking
- Code-backed recommendation coverage is strongest for Next.js and SvelteKit, supported for Nuxt route mapping with generic checks, and limited for Astro. Hono, Remix, and unknown frameworks pause up front.

If route-level metrics are unavailable, the skill pauses before scanner-only mode. Scanner-only can catch traffic-independent code issues, but it cannot rank hot routes or prove cost impact.

## Use

From the Vercel project directory, ask your coding agent:

```text
optimize this Vercel project
```

The agent should collect metrics first. If it starts by reading source files or guessing from `vercel.json`, the skill was not loaded correctly.

## Roadmap

| Attribute | Status |
|---|---|
| Route-level Vercel Function invocations, duration, TTFB, and cold starts | Supported |
| Vercel Function CPU, memory, and GB-hours | Supported |
| Request volume, cache hit rate, HTTP status, and method distribution | Supported |
| Fast Data Transfer and bot traffic patterns | Supported |
| ISR reads, writes, and over-revalidation | Supported |
| Routing Middleware volume and duration | Supported |
| External API latency, volume, and transfer bytes | Supported |
| Core Web Vitals from Speed Insights | Supported |
| Image Optimization usage, source hosts, and source bytes | Supported |
| Build Minutes fan-out | Supported |
| Usage spikes by billing service | Supported |
| Bot Protection and BotID configuration | Supported |
| Fluid Compute configuration and compute signals | Supported |
| Region pinning and project configuration mismatches | Supported |
| Observability Events cost attribution | Supported |
| Route-to-file recommendations for Next.js and SvelteKit | Supported |
| Nuxt route mapping with generic/platform checks | Supported |
| Generic route mapping and platform checks for Astro | Supported |
| Hono route-to-file mapping | Planned |
| Remix route-to-file mapping | Planned |
| AI Gateway usage and cost optimization | Planned |
| Sandbox usage and cost optimization | Planned |
| Blob, Edge Config, Runtime Cache, Workflows, Queues, Flags, and Microfrontends billing dimensions | Planned |

## What You Get

- Ranked recommendations tied to observed Vercel metrics
- Specific route and file references when source changes are justified
- Before/after code for ready recommendations
- Citations from a curated, version-aware documentation allow-list
- Held-back findings when evidence is real but not strong enough for a recommendation
- A concise final message plus a full Markdown report

## Trust Model

- Metrics come first. Code investigation starts only after signals are collected.
- Gates are deterministic JavaScript thresholds. No LLM decides whether a metric qualifies.
- Citations are allow-listed. Unknown URLs and version-mismatched framework docs are stripped.
- Project config contradictions are rejected. For example, the verifier blocks "enable Fluid Compute" when Fluid Compute is already on.
- Cost impact uses magnitude framing, not invented exact savings.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). New gates, scanners, playbooks, citations, and sanitizers need fixture coverage in `packages/vercel-optimize-tests`.

## License

MIT

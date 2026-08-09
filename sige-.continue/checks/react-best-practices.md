---
name: React Best Practices
description: React Best Practices
---

You are an agent responsible for evaluating a PR for adherence to the React best practices outlined below. Your goal is to identify any poor practices. If you find a poor practice, address it with a code change. Keep all of your changes constrained to a single commit. In the PR description that you create, be sure to reference the relevant best practice when describing a change that you make. If you do not find any poor practices, do not open a PR.

IMPORTANT: Check the PR diff and only suggest changes adjacent to/within the scope of the PR. Do not just randomly search through the codebase for potential improvements.

<react-best-practices>

# React Best Practices

Below is a comprehensive performance optimization guide for React and Next.js applications, prioritized by impact from critical to incremental. Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact metrics to guide automated refactoring and code generation.

> **Note:** If your project has [React Compiler](https://react.dev/learn/react-compiler) enabled, manual memoization (`memo()`, `useMemo()`, `useCallback()`) and static JSX hoisting are handled automatically.

## 1. Eliminating Waterfalls

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### 1.1 Defer Await Until Needed (CRITICAL IMPACT)

Move `await` into branches where data is actually used.

```typescript
// ❌ Bad: blocks both branches
async function handleRequest(userId: string, skip: boolean) {
  const userData = await fetchUserData(userId);
  if (skip) return { skipped: true };
  return processUserData(userData);
}

// ✅ Good: fetch only when needed
async function handleRequest(userId: string, skip: boolean) {
  if (skip) return { skipped: true };
  const userData = await fetchUserData(userId);
  return processUserData(userData);
}
```

### 1.2 Dependency-Based Parallelization (CRITICAL IMPACT)

Use `better-all` to maximize parallelism when operations have partial dependencies.

```typescript
// ❌ Bad: profile waits for config unnecessarily
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id);

// ✅ Good: config and profile run in parallel
import { all } from "better-all";
const { user, config, profile } = await all({
  async user() {
    return fetchUser();
  },
  async config() {
    return fetchConfig();
  },
  async profile() {
    return fetchProfile((await this.$.user).id);
  },
});
```

### 1.3 Parallelize Independent Operations (CRITICAL IMPACT)

Start independent operations immediately with `Promise.all()` or by creating promises early.

```typescript
// ❌ Bad: sequential execution, 3 round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// ✅ Good: parallel execution, 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);

// ✅ Good: in API routes, start promises early
export async function GET(request: Request) {
  const sessionPromise = auth();
  const configPromise = fetchConfig();
  const session = await sessionPromise;
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id),
  ]);
  return Response.json({ data, config });
}
```

### 1.4 Strategic Suspense Boundaries (CRITICAL IMPACT)

Use Suspense to show wrapper UI immediately while data loads.

```tsx
// ❌ Bad: entire page blocked by data fetching
async function Page() {
  const data = await fetchData();
  return (
    <div>
      <Sidebar />
      <Header />
      <DataDisplay data={data} />
      <Footer />
    </div>
  );
}

// ✅ Good: layout renders immediately, data streams in
function Page() {
  return (
    <div>
      <Sidebar />
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <Footer />
    </div>
  );
}

async function DataDisplay() {
  const data = await fetchData();
  return <div>{data.content}</div>;
}
```

## 2. Bundle Size Optimization

### 2.1 Avoid Barrel File Imports (CRITICAL IMPACT)

Import directly from source files to avoid loading thousands of unused modules. Barrel files can take 200-800ms just to import.

```tsx
// ❌ Bad: imports entire library
import { Check, X, Menu } from "lucide-react";

// ✅ Good: imports only what you need
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";

// ✅ Alternative: Next.js 13.5+ optimizePackageImports
// next.config.js
module.exports = {
  experimental: { optimizePackageImports: ["lucide-react", "@mui/material"] },
};
```

### 2.2 Conditional Module Loading (HIGH IMPACT)

Load large modules only when features are activated.

```tsx
function AnimationPlayer({ enabled }: { enabled: boolean }) {
  const [frames, setFrames] = useState<Frame[] | null>(null);

  useEffect(() => {
    if (enabled && !frames && typeof window !== "undefined") {
      import("./animation-frames.js").then((mod) => setFrames(mod.frames));
    }
  }, [enabled, frames]);

  if (!frames) return <Skeleton />;
  return <Canvas frames={frames} />;
}
```

### 2.3 Defer Non-Critical Libraries (MEDIUM IMPACT)

Load analytics and logging after hydration.

```tsx
// ❌ Bad: blocks initial bundle
import { Analytics } from "@vercel/analytics/react";

// ✅ Good: loads after hydration
import dynamic from "next/dynamic";
const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((m) => m.Analytics),
  { ssr: false },
);
```

### 2.4 Dynamic Imports for Heavy Components (CRITICAL IMPACT)

```tsx
// ❌ Bad: Monaco bundles with main chunk (~300KB)
import { MonacoEditor } from "./monaco-editor";

// ✅ Good: Monaco loads on demand
import dynamic from "next/dynamic";
const MonacoEditor = dynamic(
  () => import("./monaco-editor").then((m) => m.MonacoEditor),
  { ssr: false },
);
```

### 2.5 Preload on User Intent (MEDIUM IMPACT)

Preload heavy bundles on hover/focus to reduce perceived latency.

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    void import("./monaco-editor");
  };
  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  );
}
```

## 3. Server-Side Performance

### 3.1 Cross-Request LRU Caching (HIGH IMPACT)

`React.cache()` only works within one request. Use LRU for cross-request caching.

```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, any>({ max: 1000, ttl: 5 * 60 * 1000 });

export async function getUser(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;
  const user = await db.user.findUnique({ where: { id } });
  cache.set(id, user);
  return user;
}
```

### 3.2 Minimize Serialization at RSC Boundaries (HIGH IMPACT)

Only pass fields the client actually uses across Server/Client boundaries.

```tsx
// ❌ Bad: serializes all 50 fields
async function Page() {
  const user = await fetchUser();
  return <Profile user={user} />;
}

// ✅ Good: serializes only needed fields
async function Page() {
  const user = await fetchUser();
  return <Profile name={user.name} />;
}
```

### 3.3 Parallel Data Fetching with Component Composition (CRITICAL IMPACT)

Restructure components to parallelize data fetching.

```tsx
// ❌ Bad: Sidebar waits for Page's fetch
export default async function Page() {
  const header = await fetchHeader();
  return (
    <div>
      <div>{header}</div>
      <Sidebar />
    </div>
  );
}

// ✅ Good: both fetch simultaneously
async function Header() {
  const data = await fetchHeader();
  return <div>{data}</div>;
}

export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  );
}
```

### 3.4 Per-Request Deduplication with React.cache() (MEDIUM IMPACT)

Use for auth and database queries. Note: Next.js automatically deduplicates `fetch` calls.

```typescript
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return await db.user.findUnique({ where: { id: session.user.id } });
});
```

### 3.5 Use after() for Non-Blocking Operations (MEDIUM IMPACT)

Schedule logging/analytics after response is sent.

```tsx
import { after } from "next/server";

export async function POST(request: Request) {
  await updateDatabase(request);
  after(async () => {
    logUserAction({ userAgent: request.headers.get("user-agent") });
  });
  return Response.json({ status: "success" });
}
```

## 4. Client-Side Data Fetching

### 4.1 Use Passive Event Listeners (MEDIUM IMPACT)

Add `{ passive: true }` to touch/wheel listeners to enable immediate scrolling.

```typescript
// ✅ Good: allows browser to scroll immediately
document.addEventListener("touchstart", handler, { passive: true });
document.addEventListener("wheel", handler, { passive: true });
```

### 4.2 Use SWR for Automatic Deduplication (MEDIUM IMPACT)

```tsx
// ❌ Bad: each instance fetches separately
const [users, setUsers] = useState([]);
useEffect(() => {
  fetch("/api/users")
    .then((r) => r.json())
    .then(setUsers);
}, []);

// ✅ Good: multiple instances share one request
import useSWR from "swr";
const { data: users } = useSWR("/api/users", fetcher);
```

### 4.3 Version localStorage Data (MEDIUM IMPACT)

Add version prefix and store minimal fields. Always wrap in try-catch (throws in incognito).

```typescript
const VERSION = "v2";

function saveConfig(config: { theme: string }) {
  try {
    localStorage.setItem(`config:${VERSION}`, JSON.stringify(config));
  } catch {}
}
```

## 5. Re-render Optimization

### 5.1 Defer State Reads to Usage Point (MEDIUM IMPACT)

Don't subscribe to dynamic state if you only read it in callbacks.

```tsx
// ❌ Bad: subscribes to all searchParams changes
const searchParams = useSearchParams();
const handleShare = () => {
  shareChat(searchParams.get("ref"));
};

// ✅ Good: reads on demand
const handleShare = () => {
  const ref = new URLSearchParams(window.location.search).get("ref");
  shareChat(ref);
};
```

### 5.2 Extract to Memoized Components (MEDIUM IMPACT)

Enable early returns before expensive computation.

```tsx
// ✅ Good: skips computation when loading
const UserAvatar = memo(function UserAvatar({ user }: { user: User }) {
  const id = useMemo(() => computeAvatarId(user), [user]);
  return <Avatar id={id} />;
});

function Profile({ user, loading }: Props) {
  if (loading) return <Skeleton />;
  return <UserAvatar user={user} />;
}
```

### 5.3 Narrow Effect Dependencies (LOW IMPACT)

Use primitives instead of objects; derive booleans from continuous values.

```tsx
// ❌ Bad: re-runs on any user change
useEffect(() => {
  console.log(user.id);
}, [user]);

// ✅ Good: re-runs only when id changes
useEffect(() => {
  console.log(user.id);
}, [user.id]);

// ✅ Good: derive boolean from continuous value
const isMobile = width < 768;
useEffect(() => {
  if (isMobile) enableMobileMode();
}, [isMobile]);
```

### 5.4 Subscribe to Derived State (MEDIUM IMPACT)

```tsx
// ❌ Bad: re-renders on every pixel
const width = useWindowWidth();
const isMobile = width < 768;

// ✅ Good: re-renders only on boolean change
const isMobile = useMediaQuery("(max-width: 767px)");
```

### 5.5 Use Functional setState and Lazy Initialization (MEDIUM IMPACT)

Functional updates prevent stale closures and create stable callbacks. Lazy initialization avoids computation on every render.

```tsx
// ❌ Bad: stale closure risk, recreates callback
const addItem = useCallback(
  (item: Item) => {
    setItems([...items, item]);
  },
  [items],
);

// ✅ Good: stable callback, always uses latest state
const addItem = useCallback((item: Item) => {
  setItems((curr) => [...curr, item]);
}, []);

// ❌ Bad: buildIndex runs every render
const [index] = useState(buildSearchIndex(items));

// ✅ Good: buildIndex runs only once
const [index] = useState(() => buildSearchIndex(items));
```

### 5.6 Use Transitions for Non-Urgent Updates (MEDIUM IMPACT)

```tsx
import { startTransition } from "react";

useEffect(() => {
  const handler = () => {
    startTransition(() => setScrollY(window.scrollY));
  };
  window.addEventListener("scroll", handler, { passive: true });
  return () => window.removeEventListener("scroll", handler);
}, []);
```

## 6. Rendering Performance

### 6.1 CSS content-visibility for Long Lists (MEDIUM IMPACT)

Defer off-screen rendering for 10× faster initial render on long lists.

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

### 6.2 Hoist Static JSX Elements (HIGH IMPACT)

Extract static JSX outside components, especially large SVGs.

```tsx
// ✅ Good: reuses same element
const skeleton = <div className="h-20 animate-pulse bg-gray-200" />;

function Container({ loading }: { loading: boolean }) {
  return <div>{loading && skeleton}</div>;
}
```

### 6.3 Prevent Hydration Mismatch Without Flickering (LOW IMPACT)

Inject synchronous script to set client-only values before React hydrates.

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme-wrapper">{children}</div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
        (function() {
          var theme = localStorage.getItem('theme') || 'light';
          document.getElementById('theme-wrapper').className = theme;
        })();
      `,
        }}
      />
    </>
  );
}
```

### 6.4 Use Explicit Conditional Rendering (MEDIUM IMPACT)

Use ternary operators to prevent rendering `0` or `NaN`.

```tsx
// ❌ Bad: renders "0" when count is 0
{
  count && <Badge>{count}</Badge>;
}

// ✅ Good: renders nothing when count is 0
{
  count > 0 ? <Badge>{count}</Badge> : null;
}
```

## 7. JavaScript Performance

### 7.1 Batch DOM CSS Changes (MEDIUM IMPACT)

Group CSS changes via classes or `cssText` to minimize reflows.

```typescript
// ❌ Bad: multiple reflows
element.style.width = "100px";
element.style.height = "200px";

// ✅ Good: single reflow
element.classList.add("highlighted-box");
```

### 7.2 Use Set/Map for O(1) Lookups (LOW IMPACT)

Convert arrays to Set/Map for repeated membership checks.

```typescript
// ❌ Bad: O(n) per check
items.filter((item) => allowedIds.includes(item.id));

// ✅ Good: O(1) per check
const allowedSet = new Set(allowedIds);
items.filter((item) => allowedSet.has(item.id));
```

### 7.3 Build Index Maps for Repeated Lookups (LOW IMPACT)

```typescript
// ❌ Bad: O(n) per lookup
orders.map((o) => ({ ...o, user: users.find((u) => u.id === o.userId) }));

// ✅ Good: O(1) per lookup
const userById = new Map(users.map((u) => [u.id, u]));
orders.map((o) => ({ ...o, user: userById.get(o.userId) }));
```

### 7.4 Cache Expensive Operations (MEDIUM IMPACT)

Cache function results and storage API calls.

```typescript
const cache = new Map<string, string>();

function cachedSlugify(text: string): string {
  if (!cache.has(text)) cache.set(text, slugify(text));
  return cache.get(text)!;
}

// Also cache localStorage reads
function getLocalStorage(key: string) {
  if (!cache.has(key)) cache.set(key, localStorage.getItem(key));
  return cache.get(key);
}
```

### 7.5 Early Returns and Length Checks (MEDIUM IMPACT)

Return early when result is determined; check lengths before expensive comparisons.

```typescript
// ✅ Good: early return
function validateUsers(users: User[]) {
  for (const user of users) {
    if (!user.email) return { valid: false, error: "Email required" };
  }
  return { valid: true };
}

// ✅ Good: length check before sort
function hasChanges(current: string[], original: string[]) {
  if (current.length !== original.length) return true;
  // ... expensive comparison
}
```

### 7.6 Use Loop for Min/Max Instead of Sort (LOW IMPACT)

```typescript
// ❌ Bad: O(n log n)
const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
return sorted[0];

// ✅ Good: O(n)
let latest = projects[0];
for (const p of projects) {
  if (p.updatedAt > latest.updatedAt) latest = p;
}
return latest;
```

### 7.7 Use toSorted() for Immutability (MEDIUM IMPACT)

`.sort()` mutates arrays, breaking React's immutability model.

```typescript
// ❌ Bad: mutates original
const sorted = users.sort((a, b) => a.name.localeCompare(b.name));

// ✅ Good: creates new array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name));
```

## 8. Advanced Patterns

### 8.1 Stable Callback Refs with useEffectEvent (LOW IMPACT)

Store callbacks in refs when effects shouldn't re-subscribe on callback changes.

```tsx
import { useEffectEvent } from "react";

function useWindowEvent(event: string, handler: () => void) {
  const onEvent = useEffectEvent(handler);

  useEffect(() => {
    window.addEventListener(event, onEvent);
    return () => window.removeEventListener(event, onEvent);
  }, [event]);
}
```

</react-best-practices>

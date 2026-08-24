import { afterEach, expect, test } from "vitest";
import { clearHttpAgentCache, getOrCreateAgent } from "./httpAgentCache.js";

afterEach(async () => {
  await clearHttpAgentCache();
});

test("reuses Agent for identical request options", async () => {
  const first = await getOrCreateAgent("https:", undefined, true);
  const second = await getOrCreateAgent("https:", undefined, true);
  expect(second).toBe(first);
});

test("does not reuse Agent when verifySsl differs", async () => {
  const trusted = await getOrCreateAgent("https:", undefined, true, {
    verifySsl: true,
  });
  const insecure = await getOrCreateAgent("https:", undefined, true, {
    verifySsl: false,
  });
  expect(insecure).not.toBe(trusted);
});

test("does not reuse Agent when proxy differs", async () => {
  const direct = await getOrCreateAgent("https:", undefined, true);
  const proxied = await getOrCreateAgent("https:", "http://127.0.0.1:9", false);
  expect(proxied).not.toBe(direct);
});

test("does not reuse Agent when timeout or protocol differs", async () => {
  const def = await getOrCreateAgent("https:", undefined, true);
  const short = await getOrCreateAgent("https:", undefined, true, {
    timeout: 30,
  });
  const httpAgent = await getOrCreateAgent("http:", undefined, true);
  expect(short).not.toBe(def);
  expect(httpAgent).not.toBe(def);
});

test("treats bypassed proxy as the same as no proxy", async () => {
  const direct = await getOrCreateAgent("https:", undefined, true);
  const bypassed = await getOrCreateAgent("https:", "http://127.0.0.1:9", true);
  expect(bypassed).toBe(direct);
});

test("created Agent has keepAlive enabled", async () => {
  const agent = await getOrCreateAgent("https:", undefined, true);
  expect((agent as { keepAlive?: boolean }).keepAlive).toBe(true);
});

test("clearHttpAgentCache drops the cached instance", async () => {
  const first = await getOrCreateAgent("https:", undefined, true);
  await clearHttpAgentCache();
  const second = await getOrCreateAgent("https:", undefined, true);
  expect(second).not.toBe(first);
});

test("concurrent first requests share one Agent", async () => {
  const [a, b] = await Promise.all([
    getOrCreateAgent("https:", undefined, true),
    getOrCreateAgent("https:", undefined, true),
  ]);
  expect(a).toBe(b);
});

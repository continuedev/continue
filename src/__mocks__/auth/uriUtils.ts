import { vi } from "vitest";

export const pathToUri = vi.fn((path: string) => path);
export const slugToUri = vi.fn((slug: string) => slug);
export const uriToPath = vi.fn(() => null);
export const uriToSlug = vi.fn(() => null);

import { vi } from "vitest";

export const processPromptOrRule = vi.fn<(spec: string) => Promise<string>>();

export const processPrompt = vi.fn<(prompt: string) => Promise<string>>();

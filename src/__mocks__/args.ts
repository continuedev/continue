import { vi } from 'vitest';

export const processRule = vi.fn<(rule: string) => Promise<string>>();
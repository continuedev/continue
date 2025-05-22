// This file declares the Jest globals for TypeScript
import '@jest/globals';

declare global {
  const describe: typeof import('@jest/globals').describe;
  const expect: typeof import('@jest/globals').expect;
  const it: typeof import('@jest/globals').it;
  const test: typeof import('@jest/globals').test;
  const beforeAll: typeof import('@jest/globals').beforeAll;
  const afterAll: typeof import('@jest/globals').afterAll;
  const beforeEach: typeof import('@jest/globals').beforeEach;
  const afterEach: typeof import('@jest/globals').afterEach;
  const jest: typeof import('@jest/globals').jest;
}
# `cn`

## Overall development goals

Fight to keep `cn` simple. This is an active process. The default is that `cn` will become disastrously complicated.

### Maintainability

Maintain minimal code (avoid new features unless there is overwhelming demand or they remove a clear blocker for many users). If someone offers up a feature you should seek to understand what they actually want and then decide as a maintainer of `cn` whether this can fit into some larger concept in a simple way. If someone asks to make something configurable, you should probably consider just changing the default.

### Don't write code by hand

Use `cn` for everything. You should very rarely need to write code by hand. If you find yourself doing this outside of small tweaks, you should ask what about the codebase is causing `cn` to be unable to make the change.

If we build a system that allows us to entrust all changes to `cn` then it will be more reliable than us writing the code. Not because we can't write better code, but because `cn` is consistently thorough + it will force us to build the right systems around the code.

### Do not test by hand

If you find yourself using `npm run start` to test that existing functionality is still working, this means that you are missing a test. A green check mark from `npm test` should be full proof that the code can be shipped. See our testing strategies [here](./testing-strategies.md).

For new features you obviously need to run them yourself to apply your taste. `cn` can't match that right now.

### Minimize the number of concepts

The spec for `cn` (if it were to be fully written out) should be relatively short. This helps keep the code / spec consistent. It also allows us to keep the docs short and makes it easier for users to understand.

### Low tolerance

Tolerance for the following should be very close to zero:

- Un-addressed code reviews
- Failing tests
- Flaky tests
- Sentry issues

If we are inundated then we should build a system to solve that. For example, if it is tiresome to address all AI code reviews, then set up a trigger to have `cn` automatically address them.

### Start with a spec

High level concepts / features should have a spec when possible. Good examples of this are [modes](./modes.md), [permissions](./permissions.md), [OTLP metrics](./otlp-metrics.md), and [wire format](./wire-format.md). Like code, the spec can and should be largely auto-generated.

## Codebase Design

- We intentionally write different implementations of the "loop" instead of trying to build a single engine that can be used across TUI, headless mode, `cn serve`, and more. So far, it would be more work than it is worth to add this abstraction.
- "Everything is a service." Nobody (human or AI) should need to re-invent a polling mechanism or way to store / update state. This decision has been made already so we can focus on the business logic. The service setup lets us easily keep reactive state and avoid React anti-patterns like `useEffect`.
- We use `ink` for UI, following the same usual React principles that we do elsewhere. Keep [components](../src/ui/components/) small, avoid `useEffect`, group logic into [hooks](../src/hooks).
- Always use the [logger](../src/util/logger.ts) instead of `console.log`.
- Use commander to define [commands](../src/commands/BaseCommandOptions.ts)
- `cn remote` is intended to act the same as `cn`'s TUI in almost every way. There is a test helper that allows us to run any e2e test in _both_ remote and normal modes to ensure this is true.

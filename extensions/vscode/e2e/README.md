### Setup

When running e2e tests for the first time, or after changing non-test source code:

```bash
npm run e2e:all
```

### Run

Afterward, you can run the tests with as long as you've only changed the e2e test code:

```bash
npm run e2e:quick
```

### Writing tests

All e2e tests are separated (by folder) into

- `selectors` - functions that return elements
- `actions` - functions that perform actions on the editor
- `tests` - the actual tests, which are typically longer paths of functionality rather than individual actions

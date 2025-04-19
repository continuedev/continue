### Setup

When running e2e tests for the first time

```bash
npm run e2e:all
```

### Run

Depending on what code you update, you can use a faster loop to test your changes:

- If you update the e2e test code and/or config.yaml/json, you can run `npm run e2e:quick`
- If you update the extension code, you can run `npm run e2e:recompile`
- If you update the gui code, you can run `npm run e2e:rebuild-gui`

### Writing tests

All e2e tests are separated (by folder) into

- `selectors` - functions that return elements
- `actions` - functions that perform actions on the editor
- `tests` - the actual tests, which are typically longer paths of functionality rather than individual actions

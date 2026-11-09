# loopsbx

A tiny string utilities package.

## Usage

Both helpers are pure ESM exports from `src/strings.js`, so you can import them
directly by path (no build step, no dependencies):

```js
import { slugify, truncate } from './src/strings.js';

// slugify(text) -> lowercase, hyphen-separated slug
slugify('Hello World');        // 'hello-world'
slugify('  A -- B!! C  ');     // 'a-b-c' (runs collapse, edges trimmed)
slugify('foo_bar-baz');        // 'foo-bar-baz'
slugify('Ünïcode Café 101');   // 'ünïcode-café-101' (accented letters kept)
slugify('!!!');                // '' (nothing left, not '-')

// truncate(text, max) -> at most max characters, ellipsis counted in max
truncate('hello', 3);            // 'he…' (3 chars total)
truncate('hello', 5);            // 'hello' (already fits, no ellipsis)
truncate('Short text here', 10); // 'Short tex…'
truncate('hello', 1);            // '…'
truncate('hello', 0);            // '' (no room for the ellipsis)
```

`truncate` measures length in UTF-16 code units (`.length`), not grapheme
clusters, and a negative or non-numeric `max` yields `''`. Non-string input to
either function is coerced with `String(...)`, so neither one throws.

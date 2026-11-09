import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slugify } from '../src/strings.js';

test('slugify lowercases and joins words with single hyphens', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify collapses runs of whitespace and punctuation into one hyphen', () => {
  assert.equal(slugify('Foo   --   Bar!!!'), 'foo-bar');
  assert.equal(slugify('a.b,c;d'), 'a-b-c-d');
});

test('slugify trims hyphens from both edges', () => {
  assert.equal(slugify('  ---Hello---  '), 'hello');
  assert.equal(slugify('***'), '');
});

test('slugify turns underscores and emoji into separators', () => {
  assert.equal(slugify('foo_bar'), 'foo-bar');
  assert.equal(slugify('foo \u{1F4AF} bar'), 'foo-bar');
});

test('slugify keeps accented letters and digits', () => {
  assert.equal(slugify('Ünïcode 42 Rules'), 'ünïcode-42-rules');
});

test('slugify returns an empty string for empty or separator-only input', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('   '), '');
  assert.equal(slugify('!!!???'), '');
  assert.notEqual(slugify('!!!'), '-');
});

test('slugify coerces non-string input instead of throwing', () => {
  assert.equal(slugify(1234), '1234');
  assert.equal(slugify({ toString: () => 'Two Words' }), 'two-words');
});

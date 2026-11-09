import { test } from 'node:test';
import assert from 'node:assert/strict';

import { truncate } from '../src/strings.js';

test('truncate returns the text unchanged when it already fits', () => {
  assert.equal(truncate('hi', 10), 'hi');
  assert.equal(truncate('five', 4), 'five'); // exact fit: no ellipsis
  assert.equal(truncate('', 3), '');
});

test('truncate counts the ellipsis inside max', () => {
  assert.equal(truncate('hello', 3), 'he…');
  assert.equal(truncate('Hello World', 5), 'Hell…');
  assert.equal(truncate('Hello World', 5).length, 5);
  assert.equal(truncate('abcde', 4), 'abc…');
});

test('truncate handles the smallest useful maxima', () => {
  assert.equal(truncate('hello', 1), '…');
  assert.equal(truncate('hello', 0), '');
});

test('truncate returns an empty string for negative or non-numeric max', () => {
  assert.equal(truncate('hello', -1), '');
  assert.equal(truncate('hello', NaN), '');
  assert.equal(truncate('hello', undefined), '');
  assert.equal(truncate('hello', 'nope'), '');
});

test('truncate floors a fractional max', () => {
  assert.equal(truncate('hello', 3.9), 'he…');
});

test('truncate coerces non-string input instead of throwing', () => {
  assert.equal(truncate(123456, 4), '123…');
  assert.equal(truncate({ toString: () => 'object text' }, 7), 'object…');
  assert.equal(truncate(null, 3), 'nu…');
});

test('truncate cuts by UTF-16 length and keeps BMP letters intact', () => {
  assert.equal(truncate('ünïcode', 4), 'ünï…');
  assert.equal(truncate('ünïcode', 4).length, 4);
});

Node.js - klaw
==============

<a href="https://standardjs.com" style="float: right; padding: 0 0 20px 20px;"><img src="https://cdn.rawgit.com/feross/standard/master/sticker.svg" alt="JavaScript Standard Style" width="100" align="right"></a>

A Node.js file system walker extracted from [fs-extra](https://github.com/jprichardson/node-fs-extra).

[![npm Package](https://img.shields.io/npm/v/klaw.svg?style=flat-square)](https://www.npmjs.org/package/klaw)
[![build status](https://api.travis-ci.org/jprichardson/node-klaw.svg)](http://travis-ci.org/jprichardson/node-klaw)
[![windows build status](https://ci.appveyor.com/api/projects/status/github/jprichardson/node-klaw?branch=master&svg=true)](https://ci.appveyor.com/project/jprichardson/node-klaw/branch/master)

Install
-------

    npm i --save klaw

If you're using Typescript, we've got [types](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/11492/files):

    npm i --save-dev @types/klaw


Name
----

`klaw` is `walk` backwards :p


Sync
----

If you need the same functionality but synchronous, you can use [klaw-sync](https://github.com/manidlou/node-klaw-sync).


Usage
-----

### klaw(directory, [options])

Returns a [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) that iterates
through every file and directory starting with `dir` as the root. Every `read()` or `data` event
returns an object with two properties: `path` and `stats`. `path` is the full path of the file and
`stats` is an instance of [fs.Stats](https://nodejs.org/api/fs.html#fs_class_fs_stats).

- `directory`: The directory to recursively walk. Type `string`.
- `options`: [Readable stream options](https://nodejs.org/api/stream.html#stream_new_stream_readable_options) and
the following:
  - `queueMethod` (`string`, default: `'shift'`): Either `'shift'` or `'pop'`. On `readdir()` array, call either `shift()` or `pop()`.
  - `pathSorter` (`function`, default: `undefined`): Sorting [function for Arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
  - `fs` (`object`, default: [`graceful-fs`](https://github.com/isaacs/node-graceful-fs)): Use this to hook into the `fs` methods or to use [`mock-fs`](https://github.com/tschaub/mock-fs)
  - `filter` (`function`, default: `undefined`): Filtering [function for Arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
  - `depthLimit` (`number`, default: `undefined`): The number of times to recurse before stopping. -1 for unlimited.
  - `preserveSymlinks` (`boolean`, default: `false`): Whether symlinks should be followed or treated as items themselves. If true, symlinks will be returned as items in their own right. If false, the linked item will be returned and potentially recursed into, in its stead.

**Streams 1 (push) example:**

```js
const klaw = require('klaw')

const items = [] // files, directories, symlinks, etc
klaw('/some/dir')
  .on('data', item => items.push(item.path))
  .on('end', () => console.dir(items)) // => [ ... array of files]
```

**Streams 2 & 3 (pull) example:**

```js
const klaw = require('klaw')

const items = [] // files, directories, symlinks, etc
klaw('/some/dir')
  .on('readable', function () {
    let item
    while ((item = this.read())) {
      items.push(item.path)
    }
  })
  .on('end', () => console.dir(items)) // => [ ... array of files]
```

### Error Handling

Listen for the `error` event.

Example:

```js
const klaw = require('klaw')

klaw('/some/dir')
  .on('readable', function () {
    let item
    while ((item = this.read())) {
      // do something with the file
    }
  })
  .on('error', (err, item) => {
    console.log(err.message)
    console.log(item.path) // the file the error occurred on
  })
  .on('end', () => console.dir(items)) // => [ ... array of files]
```


### Aggregation / Filtering / Executing Actions (Through Streams)

On many occasions you may want to filter files based upon size, extension, etc.
Or you may want to aggregate stats on certain file types. Or maybe you want to
perform an action on certain file types.

You should use the module [`through2`](https://www.npmjs.com/package/through2) to easily
accomplish this.

Install `through2`:

    npm i --save through2


**Example (skipping directories):**

```js
const klaw = require('klaw')
const through2 = require('through2')

const excludeDirFilter = through2.obj(function (item, enc, next) {
  if (!item.stats.isDirectory()) this.push(item)
  next()
})

const items = [] // files, directories, symlinks, etc
klaw('/some/dir')
  .pipe(excludeDirFilter)
  .on('data', item => items.push(item.path))
  .on('end', () => console.dir(items)) // => [ ... array of files without directories]
```

**Example (ignore hidden directories):**

```js
const klaw = require('klaw')
const path = require('path')

const filterFunc = item => {
  const basename = path.basename(item)
  return basename === '.' || basename[0] !== '.'
}

klaw('/some/dir', { filter: filterFunc })
  .on('data', item => {
    // only items of none hidden folders will reach here
  })
```

**Example (totaling size of PNG files):**

```js
const klaw = require('klaw')
const path = require('path')
const through2 = require('through2')

let totalPngsInBytes = 0
const aggregatePngSize = through2.obj(function (item, enc, next) {
  if (path.extname(item.path) === '.png') {
    totalPngsInBytes += item.stats.size
  }
  this.push(item)
  next()
})

klaw('/some/dir')
  .pipe(aggregatePngSize)
  .on('data', item => items.push(item.path))
  .on('end', () => console.dir(totalPngsInBytes)) // => total of all pngs (bytes)
```


**Example (deleting all .tmp files):**

```js
const fs = require('fs')
const klaw = require('klaw')
const through2 = require('through2')

const deleteAction = through2.obj(function (item, enc, next) {
  this.push(item)

  if (path.extname(item.path) === '.tmp') {
    item.deleted = true
    fs.unlink(item.path, next)
  } else {
    item.deleted = false
    next()
  }
})

const deletedFiles = []
klaw('/some/dir')
  .pipe(deleteAction)
  .on('data', item => {
    if (!item.deleted) return
    deletedFiles.push(item.path)
  })
  .on('end', () => console.dir(deletedFiles)) // => all deleted files
```

You can even chain a bunch of these filters and aggregators together. By using
multiple pipes.

**Example (using multiple filters / aggregators):**

```js
klaw('/some/dir')
  .pipe(filterCertainFiles)
  .pipe(deleteSomeOtherFiles)
  .on('end', () => console.log('all done!'))
```

**Example passing (piping) through errors:**

Node.js does not `pipe()` errors. This means that the error on one stream, like
`klaw` will not pipe through to the next. If you want to do this, do the following:

```js
const klaw = require('klaw')
const through2 = require('through2')

const excludeDirFilter = through2.obj(function (item, enc, next) {
  if (!item.stats.isDirectory()) this.push(item)
  next()
})

const items = [] // files, directories, symlinks, etc
klaw('/some/dir')
  .on('error', err => excludeDirFilter.emit('error', err)) // forward the error on
  .pipe(excludeDirFilter)
  .on('data', item => items.push(item.path))
  .on('end', () => console.dir(items)) // => [ ... array of files without directories]
```


### Searching Strategy

Pass in options for `queueMethod`, `pathSorter`, and `depthLimit` to affect how the file system
is recursively iterated. See the code for more details, it's less than 50 lines :)



License
-------

MIT

Copyright (c) 2015 [JP Richardson](https://github.com/jprichardson)

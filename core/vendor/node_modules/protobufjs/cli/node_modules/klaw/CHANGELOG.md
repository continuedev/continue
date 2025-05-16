3.0.0 / 2018-08-01
------------------

- **BREAKING:** Follow symlinks by default (use the new `preserveSymlinks` option to get the old behavior) [#29](https://github.com/jprichardson/node-klaw/pull/29)
- **BREAKING:** Drop Node v4 support

2.1.1 / 2017-11-18
------------------

- Performance optimization [#27](https://github.com/jprichardson/node-klaw/pull/27)

2.1.0 / 2017-08-10
------------------

### Added

- Added `depthLimit` option to limit how deep to recurse into folders. [#25](https://github.com/jprichardson/node-klaw/pull/25)

2.0.0 / 2017-06-23
------------------

### Changed

- `graceful-fs` is now a regular dependency, and is always loaded. This should speed up `require` time
- Dropped support for Node 0.10 & 0.12 and io.js

1.3.1 / 2016-10-25
------------------
### Added
- `graceful-fs` added as an `optionalDependencies`. Thanks [ryanzim]!

1.3.0 / 2016-06-09
------------------
### Added
- `filter` option to pre-filter and not walk directories.

1.2.0 / 2016-04-16
------------------
- added support for custom `fs` implementation. Useful for https://github.com/tschaub/mock-fs

1.1.3 / 2015-12-23
------------------
- bugfix: if `readdir` error, got hung up. See: https://github.com/jprichardson/node-klaw/issues/1

1.1.2 / 2015-11-12
------------------
- assert that param `dir` is a `string`

1.1.1 / 2015-10-25
------------------
- bug fix, options not being passed

1.1.0 / 2015-10-25
------------------
- added `queueMethod` and `pathSorter` to `options` to affect searching strategy.

1.0.0 / 2015-10-25
------------------
- removed unused `filter` param
- bugfix: always set `streamOptions` to `objectMode`
- simplified, converted from push mode (streams 1) to proper pull mode (streams 3)

0.1.0 / 2015-10-25
------------------
- initial release

<!-- contributors -->
[ryanzim]: https://github.com/ryanzim

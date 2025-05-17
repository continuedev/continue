# Requizzle

[![Build Status](https://travis-ci.com/hegemonic/requizzle.svg?branch=master)](https://travis-ci.com/hegemonic/requizzle)

Swizzle a little something into your Node.js modules.

## What's Requizzle?

Requizzle provides a drop-in replacement for Node.js's `require()` function.
This replacement enables you to change a module's source code when Node.js loads
the module.

You can use Requizzle in your test cases, or in production code if you like to
live dangerously.

## How can I change a module with Requizzle?

There are several different ways:

### Look for modules in new places

With Requizzle, you can add directories to the module lookup path, which forces
Node.js to search those directories for modules. This can be useful if:

+ You're tired of writing code like `require('../../../../../lib/foo')`.
+ You want to expose your app's modules to external plugins.

### Add code before or after the module's source code

Tamper with modules to your heart's delight by adding arbitrary code before or
after the module's own source code.

### Mess with child modules

When you use Requizzle to require a module, you can force each child module's
`require` method to inherit your changes to the parent module. (By default, only
the parent module is changed.)

## Will Requizzle break my dependencies?

Probably not. It's true that Requizzle gives you plenty of new and exciting ways
to tamper with, and possibly break, your module dependencies. But Requizzle also
tries not to break anything on its own. In particular:

+ **Requizzle preserves strict-mode declarations**.  If a module starts with a
strict-mode declaration, Requizzle keeps it in place. Your changes will appear
after the strict-mode declaration.
+ **Requizzle leaves native modules alone**. If you use Requizzle to load one of
Node.js's built-in modules, such as `fs` or `path`, Requizzle won't mess with
it.

## Usage

The Requizzle module exports a single function, which returns a drop-in
replacement for `require()`.

When you call the function, you must pass in an `options` object, which can
include any of these properties:

+ `extras`: A pair of functions that return text to insert before or after the
module's source code. Each function accepts two parameters: `targetPath`, the
path to the required module, and `parentModule`, the `Module` object for the
module's parent. Each function must return a string.
    + `extras.before`: A function that returns text to insert before the
    module's source code.
    + `extras.after`: A function that returns text to insert after the module's
    source code.
+ `infect`: Determines whether child modules are infected with the same changes
as the parent module. Set to `true` to force child modules to inherit your
changes. Defaults to `false`.
+ `requirePaths`: Additional paths to search for required modules. For example,
if `requirePaths` is set to `['/usr/lib/junk/modules']`, and you save a
JavaScript module at `/usr/lib/junk/modules/mymodule.js`, you can require the
module as `mymodule`.

    You can provide an array of paths, which will be searched before the default
    module paths, or an object with the following properties:

    + `requirePaths.before`: An array of paths to search before the default
    module paths.
    + `requirePaths.after`: An array of paths to search after the default module
    paths. Use this property if you want the module to use its own local
    dependencies when possible, then fall back to the additional paths if
    necessary.

    By default, the require path is not changed.

## Examples

```js
const requizzle = require('requizzle');

// Say hello and goodbye to each module.
const logRequire = requizzle({
    extras: {
        before: function(targetPath, parentModule) {
            return 'console.log("Hello %s!", ' + targetPath + ');\n';
        },
        after: function(targetPath, parentModule) {
            return 'console.log("Goodbye %s!", ' + targetPath + ');\n';
        }
    }
});
// Prints "Hello /path/to/mymodule.js!" and "Goodbye /path/to/mymodule.js!"
const myModule = logRequire('mymodule');

// Look for modules in the current module's `lib` directory, and force child
// modules to do the same.
const path = require('path');
const extraPathRequire = requizzle({
    infect: true,
    requirePaths: [path.join(__dirname, 'lib')]
});
// If `foo` needs to require a module in `./lib`, it can use `require('bar')`
// instead of `require('./lib/bar')`.
const foo = extraPathRequire('./foo');
```

## Troubleshooting

Here are some problems you might run into when you use Requizzle, along with
solutions to each problem. If you run into any problems that aren't addressed
here, please file a new issue!

### Requizzle slowed down my code! A lot!

Requizzle adds minimal overhead to the module-loading process. However, your
code will run _much_ slower than usual if you do both of the following:

+ Use Requizzle's `infect` option.
+ Require modules that have a lot of `require()` calls within the scope of
individual functions.

If Requizzle seems to slow down your app, look for module calls that are within
function scope, then move them to each module's top-level scope.

### Requizzle made my module do something weird!

Do you have any
[circular dependencies](https://nodejs.org/api/modules.html#modules_cycles) in
the modules that aren't working? Circular dependencies can cause unusual
behavior with Requizzle, just as they can without Requizzle. Try breaking the
circular dependency.

### Requizzle violates the [Law of Demeter](https://en.wikipedia.org/wiki/Law_of_Demeter)! It's an unnatural abomination!

Fair enough.

## Changelog

+ 0.2.3 (July 2019): Updated dependencies.
+ 0.2.2 (May 2019): Fixed a compability issue with Node.js 12.
+ 0.2.1 (December 2014): The `requirePaths` option no longer inserts an extra
line break into the source file.
+ 0.2.0 (June 2014): The `requirePaths` option can now contain `before` and
`after` properties. Paths in the `before` property will be searched first; paths
in the `after` property will be searched last.
+ 0.1.1 (June 2014): If the `requirePaths` option is used, the module loader now
searches the extra paths first rather than last.
+ 0.1.0 (June 2014): Initial release.

## Acknowledgements ##

Requizzle is very loosely adapted from Johannes Ewald's
[rewire](https://github.com/jhnns/rewire) module, which is designed to modify a
module's behavior for unit testing. If Requizzle doesn't meet your needs, please
take a look at rewire!

## License

[MIT license](LICENSE).

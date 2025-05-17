# JSDoc

[![Build Status](https://travis-ci.org/jsdoc/jsdoc.svg?branch=master)](http://travis-ci.org/jsdoc/jsdoc)

An API documentation generator for JavaScript.

Want to contribute to JSDoc? Please read `CONTRIBUTING.md`.

Installation and Usage
----------------------

JSDoc supports stable versions of Node.js 8.15.0 and later. You can install
JSDoc globally or in your project's `node_modules` folder.

To install the latest version on npm globally (might require `sudo`;
[learn how to fix this](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)):

    npm install -g jsdoc

To install the latest version on npm locally and save it in your package's
`package.json` file:

    npm install --save-dev jsdoc

**Note**: By default, npm adds your package using the caret operator in front of
the version number (for example, `^3.6.3`). We recommend using the tilde
operator instead (for example, `~3.6.3`), which limits updates to the most
recent patch-level version. See
[this Stack Overflow answer](https://stackoverflow.com/questions/22343224) for
more information about the caret and tilde operators.

To install the latest development version locally, without updating your
project's `package.json` file:

    npm install git+https://github.com/jsdoc/jsdoc.git

If you installed JSDoc locally, the JSDoc command-line tool is available in
`./node_modules/.bin`. To generate documentation for the file
`yourJavaScriptFile.js`:

    ./node_modules/.bin/jsdoc yourJavaScriptFile.js

If you installed JSDoc globally, run the `jsdoc` command:

    jsdoc yourJavaScriptFile.js

By default, the generated documentation is saved in a directory named `out`. You
can use the `--destination` (`-d`) option to specify another directory.

Run `jsdoc --help` for a complete list of command-line options.

## Templates and tools

The JSDoc community has created templates and other tools to help you generate
and customize your documentation. Here are a few of them:

### Templates

+ [jaguarjs-jsdoc](https://github.com/davidshimjs/jaguarjs-jsdoc)
+ [DocStrap](https://github.com/docstrap/docstrap)
([example](https://docstrap.github.io/docstrap))
+ [jsdoc3Template](https://github.com/DBCDK/jsdoc3Template)
  ([example](https://github.com/danyg/jsdoc3Template/wiki#wiki-screenshots))
+ [minami](https://github.com/Nijikokun/minami)
+ [docdash](https://github.com/clenemt/docdash)
([example](http://clenemt.github.io/docdash/))
+ [tui-jsdoc-template](https://github.com/nhnent/tui.jsdoc-template)
([example](https://nhnent.github.io/tui.jsdoc-template/latest/))
+ [better-docs](https://github.com/SoftwareBrothers/better-docs)
([example](https://softwarebrothers.github.io/admin-bro-dev/index.html))

### Build tools

+ [JSDoc Grunt plugin](https://github.com/krampstudio/grunt-jsdoc)
+ [JSDoc Gulp plugin](https://github.com/mlucool/gulp-jsdoc3)

### Other tools

+ [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown)
+ [Integrating GitBook with
JSDoc](https://medium.com/@kevinast/integrate-gitbook-jsdoc-974be8df6fb3)

## For more information

+ Documentation is available at [jsdoc.app](https://jsdoc.app/).
+ Contribute to the docs at
[jsdoc/jsdoc.github.io](https://github.com/jsdoc/jsdoc.github.io).
+ [Join JSDoc's Slack channel](https://jsdoc-slack.appspot.com/).
+ Ask for help on the
[JSDoc Users mailing list](http://groups.google.com/group/jsdoc-users).
+ Post questions tagged `jsdoc` to
[Stack Overflow](http://stackoverflow.com/questions/tagged/jsdoc).

## License

JSDoc 3 is copyright (c) 2011-present Michael Mathews <micmath@gmail.com> and
the [contributors to JSDoc](https://github.com/jsdoc/jsdoc/graphs/contributors).

JSDoc 3 is free software, licensed under the Apache License, Version 2.0. See
the file `LICENSE.md` in this distribution for more details.

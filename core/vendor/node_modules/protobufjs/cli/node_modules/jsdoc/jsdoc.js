#!/usr/bin/env node

// initialize the environment for Node.js
(() => {
    const fs = require('fs');
    const path = require('path');

    let env;
    let jsdocPath = __dirname;
    const pwd = process.cwd();

    // Create a custom require method that adds `lib/jsdoc` and `node_modules` to the module
    // lookup path. This makes it possible to `require('jsdoc/foo')` from external templates and
    // plugins, and within JSDoc itself. It also allows external templates and plugins to
    // require JSDoc's module dependencies without installing them locally.
    /* eslint-disable no-global-assign, no-redeclare */
    require = require('requizzle')({
        requirePaths: {
            before: [path.join(__dirname, 'lib')],
            after: [path.join(__dirname, 'node_modules')]
        },
        infect: true
    });
    /* eslint-enable no-global-assign, no-redeclare */

    // resolve the path if it's a symlink
    if ( fs.statSync(jsdocPath).isSymbolicLink() ) {
        jsdocPath = path.resolve( path.dirname(jsdocPath), fs.readlinkSync(jsdocPath) );
    }

    env = require('./lib/jsdoc/env');
    env.dirname = jsdocPath;
    env.pwd = pwd;
    env.args = process.argv.slice(2);
})();

/**
 * Data about the environment in which JSDoc is running, including the configuration settings that
 * were used to run JSDoc.
 *
 * @deprecated As of JSDoc 3.4.0. Use `require('jsdoc/env')` to access the `env` object. The global
 * `env` object will be removed in a future release.
 * @namespace
 * @name env
 */
global.env = (() => require('./lib/jsdoc/env'))();

/**
 * Data that must be shared across the entire application.
 *
 * @deprecated As of JSDoc 3.4.0. Avoid using the `app` object. The global `app` object and the
 * `jsdoc/app` module will be removed in a future release.
 * @namespace
 * @name app
 */
global.app = (() => require('./lib/jsdoc/app'))();

(() => {
    const env = global.env;
    const cli = require('./cli');

    function cb(errorCode) {
        cli.logFinish();
        cli.exit(errorCode || 0);
    }

    cli.setVersionInfo()
        .loadConfig();

    if (!env.opts.test) {
        cli.configureLogger();
    }

    cli.logStart();

    if (env.opts.debug) {
        /**
         * Recursively print an object's properties to stdout. This method is safe to use with
         * objects that contain circular references.
         *
         * This method is available only when JSDoc is run with the `--debug` option.
         *
         * @global
         * @name dump
         * @private
         * @param {...*} obj - Object(s) to print to stdout.
         */
        global.dump = (...args) => {
            console.log(require('./lib/jsdoc/util/dumper').dump(args));
        };
    }

    cli.runCommand(cb);
})();

#!/usr/bin/env node

// Command-line tool that parses a type expression and dumps a JSON version of the parse tree.
const catharsis = require('../catharsis');
const path = require('path');
const util = require('util');

const command = path.basename(process.argv[1]);
const typeExpression = process.argv[2];
const opts = {
    describe: false,
    jsdoc: false
};
let parsedType;

function usage() {
    console.log(util.format('Usage:\n    %s typeExpression [--jsdoc] [--describe]', command));
}

function done(err) {
    /* eslint-disable no-process-exit */
    process.exit(err === undefined ? 0 : err);
    /* eslint-enable no-process-exit */
}

process.argv.slice(3).forEach(arg => {
    const parsedArg = arg.replace(/^-{2}/, '');

    if (opts[parsedArg] !== undefined) {
        opts[parsedArg] = true;
    } else {
        console.error('Unknown option "%s"', arg);
        usage();
        done(1);
    }
});

if (!typeExpression) {
    usage();
    done(1);
} else {
    try {
        parsedType = catharsis.parse(typeExpression, opts);
        if (opts.describe) {
            parsedType = catharsis.describe(parsedType);
        }
    } catch (e) {
        console.error(util.format('Unable to parse "%s" (exception follows):', typeExpression));
        console.error(e.stack || e.message);
        done(1);
    }

    console.log(JSON.stringify(parsedType, null, 2));
    done();
}

/**
 * Adds support for reusable partial jsdoc files.
 *
 * @module plugins/partial
 */
const env = require('jsdoc/env');
const fs = require('jsdoc/fs');
const path = require('path');

exports.handlers = {
    /**
     * Include a partial jsdoc
     *
     * @param e
     * @param e.filename
     * @param e.source
     * @example
     *     @partial "partial_doc.jsdoc"
     */
    beforeParse(e) {
        e.source = e.source.replace(/(@partial ".*")+/g, $ => {
            const pathArg = $.match(/".*"/)[0].replace(/"/g, '');
            const fullPath = path.join(e.filename, '..', pathArg);

            const partialData = fs.readFileSync(fullPath, env.opts.encoding);

            return partialData;
        });
    }
};

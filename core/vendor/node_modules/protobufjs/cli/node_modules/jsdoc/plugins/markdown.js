/**
 * Translate doclet descriptions from Markdown into HTML.
 *
 * @module plugins/markdown
 */
const env = require('jsdoc/env');

const config = env.conf.markdown || {};
const defaultTags = [
    'author',
    'classdesc',
    'description',
    'exceptions',
    'params',
    'properties',
    'returns',
    'see',
    'summary'
];
const hasOwnProp = Object.prototype.hasOwnProperty;
const parse = require('jsdoc/util/markdown').getParser();
let tags = [];
let excludeTags = [];

function shouldProcessString(tagName, text) {
    let shouldProcess = true;

    // we only want to process `@author` and `@see` tags that contain Markdown links
    if ( (tagName === 'author' || tagName === 'see') && !text.includes('[') ) {
        shouldProcess = false;
    }

    return shouldProcess;
}

/**
 * Process the markdown source in a doclet. The properties that should be processed are
 * configurable, but always include "author", "classdesc", "description", "exceptions", "params",
 * "properties",  "returns", and "see".  Handled properties can be bare strings, objects, or arrays
 * of objects.
 */
function process(doclet) {
    tags.forEach(tag => {
        if ( !hasOwnProp.call(doclet, tag) ) {
            return;
        }

        if (typeof doclet[tag] === 'string' && shouldProcessString(tag, doclet[tag]) ) {
            doclet[tag] = parse(doclet[tag]);
        }
        else if ( Array.isArray(doclet[tag]) ) {
            doclet[tag].forEach((value, index, original) => {
                const inner = {};

                inner[tag] = value;
                process(inner);
                original[index] = inner[tag];
            });
        }
        else if (doclet[tag]) {
            process(doclet[tag]);
        }
    });
}

// set up the list of "tags" (properties) to process
if (config.tags) {
    tags = config.tags.slice();
}
// set up the list of default tags to exclude from processing
if (config.excludeTags) {
    excludeTags = config.excludeTags.slice();
}
defaultTags.forEach(tag => {
    if (!excludeTags.includes(tag) && !tags.includes(tag)) {
        tags.push(tag);
    }
});

exports.handlers = {
    /**
     * Translate Markdown syntax in a new doclet's description into HTML. Is run
     * by JSDoc 3 whenever a "newDoclet" event fires.
     */
    newDoclet({doclet}) {
        process(doclet);
    }
};

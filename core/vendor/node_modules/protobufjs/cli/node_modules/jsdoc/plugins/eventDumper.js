/**
 * Dump information about parser events to the console.
 *
 * @module plugins/eventDumper
 */
const _ = require('underscore');
const doop = require('jsdoc/util/doop');
const dump = require('jsdoc/util/dumper').dump;
const env = require('jsdoc/env');
const util = require('util');

const conf = env.conf.eventDumper || {};

// Dump the included parser events (defaults to all events)
let events = conf.include || [
    'parseBegin',
    'fileBegin',
    'beforeParse',
    'jsdocCommentFound',
    'symbolFound',
    'newDoclet',
    'fileComplete',
    'parseComplete',
    'processingComplete'
];

// Don't dump the excluded parser events
if (conf.exclude) {
    events = _.difference(events, conf.exclude);
}

/**
 * Replace AST node objects in events with a placeholder.
 *
 * @param {Object} o - An object whose properties may contain AST node objects.
 * @return {Object} The modified object.
 */
function replaceNodeObjects(o) {
    const OBJECT_PLACEHOLDER = '<Object>';

    if (o.code && o.code.node) {
        // don't break the original object!
        o.code = doop(o.code);
        o.code.node = OBJECT_PLACEHOLDER;
    }

    if (o.doclet && o.doclet.meta && o.doclet.meta.code && o.doclet.meta.code.node) {
        // don't break the original object!
        o.doclet.meta.code = doop(o.doclet.meta.code);
        o.doclet.meta.code.node = OBJECT_PLACEHOLDER;
    }

    if (o.astnode) {
        o.astnode = OBJECT_PLACEHOLDER;
    }

    return o;
}

/**
 * Get rid of unwanted crud in an event object.
 *
 * @param {object} e The event object.
 * @return {object} The fixed-up object.
 */
function cleanse(e) {
    let result = {};

    Object.keys(e).forEach(prop => {
        // by default, don't stringify properties that contain an array of functions
        if (!conf.includeFunctions && util.isArray(e[prop]) && e[prop][0] &&
            String(typeof e[prop][0]) === 'function') {
            result[prop] = `function[${e[prop].length}]`;
        }
        // never include functions that belong to the object
        else if (typeof e[prop] !== 'function') {
            result[prop] = e[prop];
        }
    });

    // allow users to omit node objects, which can be enormous
    if (conf.omitNodes) {
        result = replaceNodeObjects(result);
    }

    return result;
}

exports.handlers = {};

events.forEach(eventType => {
    exports.handlers[eventType] = e => {
        console.log( dump({
            type: eventType,
            content: cleanse(e)
        }) );
    };
});

/**
 * Removes all symbols that begin with an underscore from the doc output. If
 * you're using underscores to denote private variables in modules, this
 * automatically hides them.
 *
 * @module plugins/underscore
 */

exports.handlers = {
    newDoclet({doclet}) {
        // Ignore comment blocks for all symbols that begin with underscore
        if (doclet.name.charAt(0) === '_' || doclet.name.substr(0, 6) === 'this._') {
            doclet.access = 'private';
        }
    }
};

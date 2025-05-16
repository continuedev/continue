/**
 * @module plugins/sourcetag
 */
const logger = require('jsdoc/util/logger');

exports.handlers = {
    /**
     * Support @source tag. Expected value like:
     *
     *     { "filename": "myfile.js", "lineno": 123 }
     *
     * Modifies the corresponding meta values on the given doclet.
     *
     * WARNING: If you are using a JSDoc template that generates pretty-printed source files,
     * such as JSDoc's default template, this plugin can cause JSDoc to crash. To fix this issue,
     * update your template settings to disable pretty-printed source files.
     *
     * @source { "filename": "sourcetag.js", "lineno": 9 }
     */
    newDoclet({doclet}) {
        let tags = doclet.tags;
        let tag;
        let value;

        // any user-defined tags in this doclet?
        if (typeof tags !== 'undefined') {
            // only interested in the @source tags
            tags = tags.filter(({title}) => title === 'source');

            if (tags.length) {
                // take the first one
                tag = tags[0];

                try {
                    value = JSON.parse(tag.value);
                }
                catch (ex) {
                    logger.error('@source tag expects a valid JSON value, like { "filename": "myfile.js", "lineno": 123 }.');

                    return;
                }

                doclet.meta = doclet.meta || {};
                doclet.meta.filename = value.filename || '';
                doclet.meta.lineno = value.lineno || '';
            }
        }
    }
};

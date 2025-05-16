/* eslint-disable spaced-comment */
/**
 * Demonstrate how to modify the source code before the parser sees it.
 *
 * @module plugins/commentConvert
 */
exports.handlers = {
    ///
    /// Convert ///-style comments into jsdoc comments.
    /// @param e
    /// @param e.filename
    /// @param e.source
    ///
    beforeParse(e) {
        e.source = e.source.replace(/(\n[ \t]*\/\/\/[^\n]*)+/g, $ => {
            const replacement = `\n/**${$.replace(/^[ \t]*\/\/\//mg, '').replace(/(\n$|$)/, '*/$1')}`;

            return replacement;
        });
    }
};

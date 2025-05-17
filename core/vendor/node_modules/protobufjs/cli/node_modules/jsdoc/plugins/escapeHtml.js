/**
 * Escape HTML tags in descriptions.
 *
 * @module plugins/escapeHtml
 */
exports.handlers = {
    /**
     * Translate HTML tags in descriptions into safe entities. Replaces <, & and newlines
     */
    newDoclet({doclet}) {
        if (doclet.description) {
            doclet.description = doclet.description
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/\r\n|\n|\r/g, '<br>');
        }
    }
};

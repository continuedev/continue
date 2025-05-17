/**
 * Strips the rails template tags from a js.erb file
 *
 * @module plugins/railsTemplate
 */
exports.handlers = {
    /**
     * Remove rails tags from the source input (e.g. <% foo bar %>)
     *
     * @param e
     * @param e.filename
     * @param e.source
     */
    beforeParse(e) {
        if (e.filename.match(/\.erb$/)) {
            e.source = e.source.replace(/<%.*%>/g, '');
        }
    }
};

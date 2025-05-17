/**
 * This is just an example.
 *
 * @module plugins/shout
 */
exports.handlers = {
    /**
     * Make your descriptions more shoutier.
     */
    newDoclet({doclet}) {
        if (typeof doclet.description === 'string') {
            doclet.description = doclet.description.toUpperCase();
        }
    }
};

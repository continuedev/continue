/**
 * Remove everything in a file except JSDoc-style comments. By enabling this plugin, you can
 * document source files that are not valid JavaScript (including source files for other languages).
 * @module plugins/commentsOnly
 */
exports.handlers = {
    beforeParse(e) {
        // a JSDoc comment looks like: /**[one or more chars]*/
        const comments = e.source.match(/\/\*\*[\s\S]+?\*\//g);

        if (comments) {
            e.source = comments.join('\n\n');
        } else {
            e.source = ''; // If file has no comments, parser should still receive no code
        }
    }
};

To create or use your own template:

1. Create a folder with the same name as your template (for example, `mycooltemplate`).
2. Within the template folder, create a file named `publish.js`. This file must be a CommonJS module that exports a method named `publish`.

For example:

````javascript
/** @module publish */

/**
 * Generate documentation output.
 *
 * @param {TAFFY} data - A TaffyDB collection representing
 *                       all the symbols documented in your code.
 * @param {object} opts - An object with options information.
 */
exports.publish = function(data, opts) {
    // do stuff here to generate your output files
};
````

To invoke JSDoc 3 with your own template, use the `-t` command line option, and specify the path to your template folder:

````
./jsdoc mycode.js -t /path/to/mycooltemplate
````

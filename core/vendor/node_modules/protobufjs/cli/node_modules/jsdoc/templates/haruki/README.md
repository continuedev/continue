OVERVIEW
========

JSDoc 3 Haruki is an experimental template optimised for use with publishing processes that consume either JSON or XML. Whereas the default JSDoc template outputs an HTML representation of your API, Haruki will output a JSON, or optionally an XML, representation.

Currently Haruki only supports a subset of the tags supported by the default template. Those are:

  * @name
  * @desc
  * @type
  * @namespace
  * @method (or @function)
  * @member (or @var)
  * @class
  * @mixin
  * @event
  * @param
  * @returns
  * @throws
  * @example
  * @access (like @private or @public)

This limited support set is intentional, as it is meant to be a usable set that could be shared with either JavaScript or PHP documentation -- another experimental tool, named "Vonnegut", can produce Haruki compatible JSON from PHPDoc tags.

Note: `@link`s will appear in the output untransformed, there is no way to know at this stage what the file layout of your output will eventually be. It is assumed that whatever process emits the final output file/s will transform `@link` tags at that point.

USAGE
=====

    ./jsdoc myscript.js -t templates/haruki -d console -q format=xml

The results of this command will appear in `stdout` and can be piped into other tools for further processing.

MORE
=====

If you are interested in Haruki, you are encouraged to discuss your questions or ideas on the JSDoc-Users mailing list and fork/contribute to this project.

For more information contact Michael Mathews at <micmath+haruki@gmail.com>.
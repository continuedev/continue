## 4.0.2

-   Update dependencies
-   Export options interfaces in main module
-   Update example to include root attribute

## 4.0.1

-   Update dependencies
-   Use ESLint instead of TSLint
-   Use npm instead of gulp

## 4.0.0

-   Do not indent multi-line strings
-   Use self-closing tags, unless otherwise specified
-   Add option to automatically replace invalid characters with U+FFFD
-   Add option to suppress certain values from output
-   Add support for adding to existing xmlcreate object
-   Remove certain unnecessary validation rules
-   Bug fixes
-   Correct errors in documentation

## 3.0.0

-   Bug fixes
-   Add null and undefined in type declarations
-   Remove explicit engines requirement

## 2.0.2

-   Bug fixes

## 2.0.1

-   Remove unnecessary development dependencies from npm shrinkwrap

## 2.0.0

-   Re-write in TypeScript
-   Re-write to use xmlcreate (greatly simplifies module source)
-   Added support for the ECMAScript 2015 Map and Set objects
-   New method of calling module:

    ```javascript
    var js2xmlparser = require("js2xmlparser");

    var root = "root";
    var data = {hello: "world"};
    var options = {};

    // old method (no longer works):
    // js2xmlparser(root, data, options);

    // new method:
    js2xmlparser.parse(root, data, options);
    ```

-   New options and changes to functionality of some existing options:
    -   `declaration` contains additional options
    -   `attributeString` has additional functionality
    -   `valueString` has additional functionality
    -   The functionality provided by `prettyPrinting` is now provided by the new
        `format` option, which contains additional options
    -   `arrayMap` is now `wrapHandlers` to reflect the fact that wrapping is
        provided for both arrays and ES2015 sets
    -   `convertMap` is now `typeHandlers` to match the name change to `arrayMap`
    -   The functionality provided by `useCDATA` is now provided by the new
        `cdataInvalidChars` and `cdataKeys` options, which also provide additional
        functionality
    -   Added support for document type definitions using the `dtd` option

## 1.0.0

-   First stable release
-   Add arrayMap feature
-   Switch to semantic versioning
-   Switch to Apache 2.0 license

## 0.1.9

-   Fix error in example.js

## 0.1.8

-   Reconcile readme and tests with examples

## 0.1.7

-   Added .gitattributes to .gitignore file
-   Minor tweaks to examples

## 0.1.6

-   Addition of alias string option
-   Minor changes to examples
-   Minor fixes to tests

## 0.1.5

-   Bug fixes
-   Minor changes to examples

## 0.1.4

-   Removed callFunctions option (functionality already provided by convertMap option)
-   Removed wrapArray option (functionality already provided by existing array functionality)
-   Escape numbers when at tbe beginning of an element name
-   Edits to documentation
-   Added tests
-   Added copyright headers to individual JS files

## 0.1.3

-   Fixed crash when undefined objects are converted to strings
-   Added callFunctions option
-   Added wrapArray option
-   Added useCDATA option
-   Added convertMap option
-   Added copyright year and "and other contributors" to license

## 0.1.2

-   Fixed crash when null objects are converted to strings

## 0.1.1

-   Fixed accidental truncation of XML when pretty-printing is disabled
-   Removed copyright year from license

## 0.1.0

-   Initial release

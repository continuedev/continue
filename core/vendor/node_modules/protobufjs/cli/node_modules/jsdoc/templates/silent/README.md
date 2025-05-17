OVERVIEW
========

The `silent` template outputs nothing at all.  Why would that be useful?  Primarily for running JSDoc as a linter to check for syntax errors and unrecognized tags in documentation comments, although it may also be useful for testing or benchmarking purposes.

USAGE
=====

    ./jsdoc myscript.js -t templates/silent -a all --pedantic

This command exits with a non-zero exit code if any errors are encountered.  It writes nothing to disk and the only output it produces is any error messages written to `stderr`.  This command can also be used to warn about tags which are unknown to JSDoc by setting `"allowUnknownTags": false` in a configuration file.

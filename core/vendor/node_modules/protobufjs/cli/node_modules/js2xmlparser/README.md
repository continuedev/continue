# js2xmlparser

[![Node.js CI](https://github.com/michaelkourlas/node-js2xmlparser/actions/workflows/node.js.yml/badge.svg)](https://github.com/michaelkourlas/node-js2xmlparser/actions/workflows/node.js.yml)
[![npm version](https://badge.fury.io/js/js2xmlparser.svg)](https://badge.fury.io/js/js2xmlparser)

## Overview

js2xmlparser is a Node.js module that parses JavaScript objects into XML.

## Features

Since XML is a data-interchange format, js2xmlparser is designed primarily for
JSON-type objects, arrays and primitive data types, like many of the other
JavaScript to XML parsers currently available for Node.js.

However, js2xmlparser is capable of parsing any object, including native
JavaScript objects such as `Date` and `RegExp`, by taking advantage of each
object's `toString` function or, if this function does not exist, the `String`
constructor.

js2xmlparser also has support for the `Map` and `Set` objects introduced in
ECMAScript 2015, treating them as JSON-type objects and arrays respectively.
Support for `Map`s is necessary to generate XML with elements in a specific
order, since JSON-type objects do not guarantee insertion order. `Map` keys are
always converted to strings using the method described above.

js2xmlparser also supports a number of constructs unique to XML:

-   attributes (through an attribute property in objects)
-   mixed content (through value properties in objects)
-   multiple elements with the same name (through arrays)

js2xmlparser can also pretty-print the XML it outputs.

## Installation

The easiest way to install js2xmlparser is using npm:

```
npm install js2xmlparser
```

You can also build js2xmlparser from source using npm:

```
git clone https://github.com/michaelkourlas/node-js2xmlparser.git
npm install
npm run-script build
```

The `build` script will build the production variant of js2xmlparser, run all
tests, and build the documentation.

You can build the production variant without running tests using the script
`prod`. You can also build the development version using the script `dev`.
The only difference between the two is that the development version includes
source maps.

## Usage

The documentation for the current version is available [here](http://www.kourlas.com/node-js2xmlparser/docs/4.0.2/).

You can also build the documentation using npm:

```
npm run-script docs
```

## Examples

The following example illustrates the basic usage of js2xmlparser:

```javascript
var js2xmlparser = require("js2xmlparser");

var obj = {
    "@": {
        type: "natural",
    },
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: new Date(1964, 7, 26),
    address: {
        "@": {
            type: "home",
        },
        streetAddress: "3212 22nd St",
        city: "Chicago",
        state: "Illinois",
        zip: 10000,
    },
    phone: [
        {
            "@": {
                type: "home",
            },
            "#": "123-555-4567",
        },
        {
            "@": {
                type: "cell",
            },
            "#": "890-555-1234",
        },
        {
            "@": {
                type: "work",
            },
            "#": "567-555-8901",
        },
    ],
    email: "john@smith.com",
};

console.log(js2xmlparser.parse("person", obj));
```

This example produces the following XML:

```xml
<?xml version='1.0'?>
<person type='natural'>
    <firstName>John</firstName>
    <lastName>Smith</lastName>
    <dateOfBirth>Wed Aug 26 1964 00:00:00 GMT-0400 (Eastern Summer Time)</dateOfBirth>
    <address type='home'>
        <streetAddress>3212 22nd St</streetAddress>
        <city>Chicago</city>
        <state>Illinois</state>
        <zip>10000</zip>
    </address>
    <phone type='home'>123-555-4567</phone>
    <phone type='cell'>890-555-1234</phone>
    <phone type='work'>567-555-8901</phone>
    <email>john@smith.com</email>
</person>
```

Additional examples can be found in the examples directory.

## Tests

js2xmlparser includes a set of tests to verify core functionality. You can run
the tests using npm:

```
npm run-script test-prod
```

The only difference between the `test-prod` and `test-dev` scripts is that the
development version includes source maps.

## License

js2xmlparser is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).

# xmlcreate #

[![Node.js CI](https://github.com/michaelkourlas/node-xmlcreate/actions/workflows/node.js.yml/badge.svg)](https://github.com/michaelkourlas/node-xmlcreate/actions/workflows/node.js.yml)
[![npm version](https://badge.fury.io/js/xmlcreate.svg)](https://badge.fury.io/js/xmlcreate)

## Overview ##

xmlcreate is a Node.js module that can be used to build XML using a simple API.

## Features ##

xmlcreate allows you to use a series of chained function calls to build an XML
tree.

Once the tree is built, it can be serialized to text. The formatting of the
text is customizable.

xmlcreate can perform some basic validation to check that the resulting XML
is well-formed.

## Installation ##

The easiest way to install xmlcreate is using npm:

```
npm install xmlcreate
```

You can also build xmlcreate from source using npm:

```
git clone https://github.com/michaelkourlas/node-xmlcreate.git
npm install
npm run-script build
```

The `build` script will build the production variant of xmlcreate, run all
tests, and build the documentation.

You can build the production variant without running tests using the script
`prod`. You can also build the development version using the script `dev`.
The only difference between the two is that the development version includes
source maps.

## Usage ##

The documentation for the current version is available [here](http://www.kourlas.com/node-xmlcreate/docs/2.0.4/).

You can also build the documentation using npm:

```
npm run-script docs
```

## Examples ##

The following TypeScript example illustrates the basic usage of xmlcreate:

```typescript
import {document} from "xmlcreate";

const tree = document();
tree
    .decl({encoding: "UTF-8"})
        .up()
    .dtd({
             name: "html",
             pubId: "-//W3C//DTD XHTML 1.0 Strict//EN",
             sysId: "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"
        })
        .up()
    .element({name: "html"})
        .attribute({name: "xmlns"})
            .text({charData: "http://www.w3.org/1999/xhtml"})
                .up()
            .up()
        .attribute({name: "xml:lang"})
            .text({charData: "en"})
                .up()
            .up()
        .element({name: "head"})
            .element({name: "title"})
                .charData({charData: "My page title"})
                    .up()
                .up()
            .up()
        .element({name: "body"})
            .element({name: "h1"})
                .charData({charData: "Welcome!"})
                    .up()
                .up()
            .element({name: "p"})
                .charData({charData: "This is some text on my website."})
                    .up()
                .up()
        .element({name: "div"})
            .element({name: "img"})
                .attribute({name: "src"})
                    .text({charData: "picture.png"})
                        .up()
                    .up()
                .attribute({name: "alt"})
                    .text({charData: "picture"}).up().up().up().up().up();

console.log(tree.toString({doubleQuotes: true}));
```

This example produces the following XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
        <title>My page title</title>
    </head>
    <body>
        <h1>Welcome!</h1>
        <p>This is some text on my website.</p>
    </body>
</html>
```

A JavaScript version of this example can be found in the examples directory.

## Tests ##

xmlcreate includes a set of tests to verify core functionality. You can run
the tests using npm:

```
npm run-script test-prod
```

The only difference between the `test-prod` and `test-dev` scripts is that the
development version includes source maps.

## License ##

xmlcreate is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
Please see the LICENSE file for more information.

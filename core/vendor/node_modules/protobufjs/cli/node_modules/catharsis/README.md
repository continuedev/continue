# Catharsis

[![Build Status][travis-img]][travis-url]

[travis-img]: https://travis-ci.com/hegemonic/catharsis.svg?branch=master
[travis-url]: https://travis-ci.com/hegemonic/catharsis

A JavaScript parser for
[Google Closure Compiler](https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler#type-expressions)
and [JSDoc](https://github.com/jsdoc/jsdoc) type expressions.

Catharsis is designed to be:

+ **Accurate**. Catharsis is based on a [PEG.js](https://pegjs.org/) grammar
that's designed to handle any valid type expression. It uses a thorough test
suite to verify the parser's accuracy.
+ **Fast**. Parse results are cached, so the parser is invoked only when
necessary.
+ **Flexible**. Catharsis can convert a parse result back into a type
expression, or into a description of the type expression. In addition, Catharsis
can parse [JSDoc](https://github.com/jsdoc/jsdoc)-style type expressions.


## Example

```js
const catharsis = require('catharsis');

// Closure Compiler parsing
const type = '!Object';
let parsedType;
try {
    parsedType = catharsis.parse(type); // {"type":"NameExpression,"name":"Object","nullable":false}
} catch(e) {
    console.error('unable to parse %s: %s', type, e);
}

// JSDoc-style type expressions enabled
const jsdocType = 'string[]';  // Closure Compiler expects Array.<string>
let parsedJsdocType;
try {
    parsedJsdocType = catharsis.parse(jsdocType, {jsdoc: true});
} catch (e) {
    console.error('unable to parse %s: %s', jsdocType, e);
}

// Converting parse results back to type expressions
catharsis.stringify(parsedType);                              // !Object
catharsis.stringify(parsedJsdocType);                         // string[]
catharsis.stringify(parsedJsdocType, {restringify: true});    // Array.<string>

// Converting parse results to descriptions of the type expression
catharsis.describe(parsedType).simple;                        // non-null Object
catharsis.describe(parsedJsdocType).simple;                   // Array of string
```

See the
[`test/specs` directory](https://github.com/hegemonic/catharsis/tree/master/test/specs)
for more examples of Catharsis' parse results.

## Methods

### `parse(typeExpression, options)`

Parse a type expression, and return the parse results. Throws an error if the
type expression cannot be parsed.

When called without options, Catharsis attempts to parse type expressions in the
same way as Closure Compiler. When the `jsdoc` option is enabled, Catharsis can
also parse several kinds of type expressions that are permitted in
[JSDoc](https://github.com/jsdoc/jsdoc):

+ The string `function` is treated as a function type with no parameters.
+ You can omit the period from type applications. For example,
`Array.<string>` and `Array<string>` are parsed in the same way.
+ If can append `[]` to a name expression (for example, `string[]`), it is
interpreted as a type application with the expression `Array` (for example,
`Array.<string>`).
+ Name expressions can contain the characters `#`, `~`, `:`, and `/`.
+ Name expressions can contain a suffix that is similar to a function signature
(for example, `MyClass(foo, bar)`).
+ Name expressions can contain a reserved word.
+ Record types can use types other than name expressions for keys.

#### Parameters

+ `type`: A string containing a Closure Compiler type expression.
+ `options`: Options for parsing the type expression.
    + `options.jsdoc`: Specifies whether to enable parsing of JSDoc-style type
    expressions. Defaults to `false`.
    + `options.useCache`: Specifies whether to use the cache of parsed types.
    Defaults to `true`.

#### Returns

An object containing the parse results. See the
[`test/specs` directory](https://github.com/hegemonic/catharsis/tree/master/test/specs)
for examples of the parse results for different type expressions.

The object also includes two non-enumerable properties:

+ `jsdoc`: A boolean that indicates whether the type expression was parsed with
JSDoc support enabled.
+ `typeExpression`: A string that contains the type expression that was parsed.

### `stringify(parsedType, options)`

Stringify `parsedType`, and return the type expression. If validation is
enabled, throws an error if the stringified type expression cannot be parsed.

#### Parameters ####
+ `parsedType`: An object containing a parsed Closure Compiler type expression.
+ `options`: Options for stringifying the parse results.
    + `options.cssClass`: Synonym for `options.linkClass`. Deprecated in version
    0.8.0; will be removed in a future version.
    + `options.htmlSafe`: Specifies whether to return an HTML-safe string that
    replaces left angle brackets (`<`) with the corresponding entity (`&lt;`).
    **Note**: Characters in name expressions are not escaped.
    + `options.linkClass`: A CSS class to add to HTML links. Used only if
    `options.links` is provided. By default, no CSS class is added.
    + `options.links`: An object or map whose keys are name expressions and
    whose values are URIs. If a name expression matches a key in
    `options.links`, the name expression will be wrapped in an HTML `<a>` tag
    that links to the URI. If you also specify `options.linkClass`, the `<a>`
    tag includes a `class` attribute. **Note**: When using this option, parsed
    types are always restringified, and the resulting string is not cached.
    + `options.restringify`: Forces Catharsis to restringify the parsed type. If
    this option is not specified, and the parsed type object includes a
    `typeExpression` property, Catharsis returns the `typeExpression` property
    without modification when possible. Defaults to `false`.
    + `options.useCache`: Specifies whether to use the cache of stringified type
    expressions. Defaults to `true`.
    + `options.validate`: Specifies whether to validate the stringified parse
    results by attempting to parse them as a type expression. If the stringified
    results are not parsable with the default options, you must also provide the
    appropriate options to pass to the `parse()` method. Defaults to `false`.

#### Returns

A string containing the type expression.

### `describe(parsedType, options)`

Convert a parsed type to a description of the type expression. This method is
especially useful if your users are not familiar with the syntax for type
expressions.

The `describe()` method returns the description in two formats:

+ **Simple format**. A string that provides a complete description of the type
expression.
+ **Extended format**. An object that separates out some of the details about
the outermost type expression, such as whether the type is optional, nullable,
or repeatable.

For example, when you call `describe('?function(new:MyObject, string)=')`, the
method returns the following data:

```js
{
  simple: 'optional nullable function(constructs MyObject, string)',
  extended: {
    description: 'function(string)',
    modifiers: {
      functionNew: 'Returns MyObject when called with new.',
      functionThis: '',
      optional: 'Optional.',
      nullable: 'May be null.',
      repeatable: ''
    },
    returns: ''
  }
}
```

#### Parameters

+ `parsedType`: An object containing a parsed Closure Compiler type expression.
+ `options`: Options for creating the description.
    + `options.codeClass`: A CSS class to add to the tag that is wrapped around
    type names. Used only if you specify `options.codeTag`. By default, no CSS
    class is added.
    + `options.codeTag`: The name of an HTML tag (for example, `code`) to wrap
    around type names. For example, if this option is set to `code`, the type
    expression `Array.<string>` would have the simple description
    `<code>Array</code> of <code>string</code>`.
    + `options.language`: A string identifying the language in which to generate
    the description. The identifier should be an
    [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
    (for example, `en`). It can optionally be followed by a hyphen and an
    [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
    (for example, `en-US`). If you use values other than `en`, you must provide
    translation resources in `options.resources`. Defaults to `en`.
    + `options.linkClass`: A CSS class to add to HTML links. Used only if
    `options.links` is provided. By default, no CSS class is added.
    + `options.links`: An object or map whose keys are name expressions and
    whose values are URIs. If a name expression matches a key in
    `options.links`, the name expression will be wrapped in an HTML `<a>` tag
    that links to the URI. If you also specify `options.linkClass`, the `<a>`
    tag includes a `class` attribute. **Note**: When you use this option, the
    description is not cached.
    + `options.resources`: An object that specifies how to describe type
    expressions for a given language. The object's property names should use the
    same format as `options.language`. Each property should contain an object in
    the same format as the translation resources in
    [`res/en.json`](https://github.com/hegemonic/catharsis/blob/master/res/en.json).
    If you specify a value for `options.resources.en`, that value overrides the
    defaults in `res/en.json`.
    + `options.useCache`: Specifies whether to use the cache of descriptions.
    Defaults to `true`.

### Returns

An object with the following properties:

+ `simple`: A string that provides a complete description of the type
expression.
+ `extended`: An object containing details about the outermost type expression.
    + `extended.description`: A string that provides a basic description of the
    type expression, excluding the information contained in other properties.
    + `extended.modifiers`: Information about modifiers that apply to the type
    expression.
        + `extended.modifiers.functionNew`: A string that describes what a
        function returns when called with `new`. Returned only for function
        types.
        + `extended.modifiers.functionThis`: A string that describes what the
        keyword `this` refers to within a function. Returned only for function
        types.
        + `extended.modifiers.nullable`: A string that indicates whether the
        type is nullable or non-nullable.
        + `extended.modifiers.optional`: A string that indicates whether the
        type is optional.
        + `extended.modifiers.repeatable`: A string that indicates whether the
        type can be repeated.
    + `extended.returns`: A string that describes the function's return value.
    Returned only for function types.

## Changelog

+ 0.9.0 (June 2020):
    + For the `describe()` and `stringify()` methods, the `options.links`
    parameter now accepts either a map or an object.
    + Catharsis now requires Node.js 10 or later.
+ 0.8.11 (July 2019): Updated dependencies.
+ 0.8.10 (May 2019): Updated dependencies.
+ 0.8.9 (July 2017): Type expressions that include an `@` sign (for example,
`module:@prefix/mymodule~myCallback`) are now supported.
+ 0.8.8 (April 2016): Corrected the description of type applications other than
arrays that contain a single type (for example, `Promise.<string>`).
+ 0.8.7 (June 2015):
    + Record types that use numeric literals as property names (for example,
    `{0: string}`) are now parsed correctly.
    + Record types with a property that contains a function, with no space after
    the preceding colon (for example, `{foo:function()}`), are now parsed
    correctly.
    + Repeatable function parameters are no longer required to be enclosed in
    brackets, regardless of whether JSDoc-style type expressions are enabled. In
    addition, the brackets are omitted when stringifying a parsed type
    expression.
+ 0.8.6 (December 2014): Improved the description of the unknown type.
+ 0.8.5 (December 2014): Added support for postfix nullable/non-nullable
operators combined with the optional operator (for example, `foo?=`).
+ 0.8.4 (December 2014): JSDoc-style nested arrays (for example, `number[][]`)
are now parsed correctly when JSDoc-style type expressions are enabled.
+ 0.8.3 (October 2014):
    + Type applications are no longer required to include a period (`.`) as a
    separator, regardless of whether JSDoc-style type expressions are enabled.
    + Type unions that are not enclosed in parentheses can now include the
    repeatable (`...`) modifier when JSDoc-style type expressions are enabled.
    + Name expressions may now be enclosed in single or double quotation marks
    when JSDoc-style type expressions are enabled.
+ 0.8.2 (June 2014): Fixed a compatibility issue with the JSDoc fork of Mozilla
Rhino.
+ 0.8.1 (June 2014): Added support for type unions that are not enclosed in
parentheses, and that contain nullable or non-nullable modifiers (for example,
`!string|!number`).
+ 0.8.0 (May 2014):
    + Added a `describe()` method, which converts a parsed type to a description
    of the type.
    + Added a `linkClass` option to the `stringify()` method, and deprecated the
    existing `cssClass` option. The `cssClass` option will be removed in a
    future release.
    + Clarified and corrected several sections in the `README`.
+ 0.7.1 (April 2014): In record types, property names that begin with a keyword
(for example, `undefinedHTML`) are now parsed correctly when JSDoc-style type
expressions are enabled.
+ 0.7.0 (October 2013):
    + Repeatable type expressions other than name expressions (for example,
    `...function()`) are now parsed and stringified correctly.
    + Type expressions that are both repeatable and either nullable or
    non-nullable (for example, `...!number`) are now parsed and stringified
    correctly.
    + Name expressions are now parsed correctly when they match a property name
    in an object instance (for example, `constructor`).
+ 0.6.0 (September 2013): Added support for the type expression `function[]`
when JSDoc-style type expressions are enabled.
+ 0.5.6 (April 2013):
    + For consistency with Closure Compiler, parentheses are no longer required
    around type unions, regardless of whether JSDoc-style type expressions are
    enabled.
    + For consistency with Closure Compiler, you can now use postfix notation
    for the `?` (nullable) and `!` (non-nullable) modifiers. For example,
    `?string` and `string?` are now treated as equivalent.
    + String literals and numeric literals are now allowed as property names
    within name expressions. For example, the name expression `Foo."bar"` is now
    parsed correctly.
+ 0.5.5 (April 2013): Corrected a parsing issue with name expressions that end
with a value enclosed in parentheses.
+ 0.5.4 (April 2013):
    + Repeatable literals (for example, `...*`) are now parsed correctly.
    + When JSDoc-style type expressions are enabled, a name expression can now
    contain a value enclosed in parentheses at the end of the name expression
    (for example, `MyClass(2)`).
+ 0.5.3 (March 2013): The `parse()` method now correctly parses name expressions
that contain hyphens.
+ 0.5.2 (March 2013): The `parse()` method now correctly parses function types
when JSDoc-style type expressions are enabled.
+ 0.5.1 (March 2013): Newlines and extra spaces are now removed from type
expressions before they are parsed.
+ 0.5.0 (March 2013):
    + The `parse()` method's `lenient` option has been renamed to `jsdoc`.
    **Note**: This change is not backwards-compatible with previous versions.
    + The `stringify()` method now accepts `cssClass` and `links` options, which
    you can use to add HTML links to a type expression.
+ 0.4.3 (March 2013):
    + The `stringify()` method no longer caches HTML-safe type expressions as if
    they were normal type expressions.
    + The `stringify()` method's options parameter may now include an
    `options.restringify` property, and the behavior of the `options.useCache`
    property has changed.
+ 0.4.2 (March 2013):
    + When lenient parsing is enabled, name expressions can now contain the
    characters `:` and `/`.
    + When lenient parsing is enabled, a name expression followed by `[]` (for
    example, `string[]`) will be interpreted as a type application with the
    expression `Array` (for example, `Array.<string>`).
+ 0.4.1 (March 2013):
    + The `parse()` and `stringify()` methods now honor all of the specified
    options.
    + When lenient parsing is enabled, name expressions can now contain a
    reserved word.
+ 0.4.0 (March 2013):
    + Catharsis now supports a lenient parsing option that can parse several
    kinds of malformed type expressions. See the documentation for details.
    + The objects containing parse results are now frozen.
    + The objects containing parse results now have two non-enumerable
    properties:
        + `lenient`: A boolean indicating whether the type expression was parsed
        in lenient mode.
        + `typeExpression`: A string containing the original type expression.
    + The `stringify()` method now honors the `useCache` option. If a parsed
    type includes a `typeExpression` property, and `useCache` is not set to
    `false`, the stringified type will be identical to the original type
    expression.
+ 0.3.1 (March 2013): Type expressions that begin with a reserved word, such as
`integer`, are now parsed correctly.
+ 0.3.0 (March 2013):
    + The `parse()` and `stringify()` methods are now synchronous, and the
    `parseSync()` and `stringifySync()` methods have been removed. **Note**:
    This change is not backwards-compatible with previous versions.
    + The parse results now use a significantly different format from previous
    versions. The new format is more expressive and is similar, but not
    identical, to the format used by the
    [doctrine](https://github.com/eslint/doctrine) parser. **Note**: This change
    is not backwards-compatible with previous versions.
    + Name expressions that contain a reserved word now include a
    `reservedWord: true` property.
    + Union types that are optional or nullable, or that can be repeated, are
    now parsed and stringified correctly.
    + Optional function types and record types are now parsed and stringified
    correctly.
    + Function types now longer include `new` or `this` properties unless the
    properties are defined in the type expression. In addition, the `new` and
    `this` properties can now use any type expression.
    + In record types, the key for a field type can now use any type expression.
    + Standalone single-character literals, such as ALL (`*`), are now parsed
    and stringified correctly.
    + `null` and `undefined` literals with additional properties, such as
    `repeatable`, are now stringified correctly.
+ 0.2.0 (November 2012):
    + Added `stringify()` and `stringifySync()` methods, which convert a parsed
    type to a type expression.
    + Simplified the parse results for function signatures. **Note**: This
    change is not backwards-compatible with previous versions.
    + Corrected minor errors in README.md.
+ 0.1.1 (November 2012): Added `opts` argument to `parse()` and `parseSync()`
methods. **Note**: The change to `parse()` is not backwards-compatible with
previous versions.
+ 0.1.0 (November 2012): Initial release.

## License

[MIT license](https://github.com/hegemonic/catharsis/blob/master/LICENSE).

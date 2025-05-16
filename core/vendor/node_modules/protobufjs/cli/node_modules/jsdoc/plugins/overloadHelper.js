/**
 * The Overload Helper plugin automatically adds a signature-like string to the longnames of
 * overloaded functions and methods. In JSDoc, this string is known as a _variation_. (The longnames
 * of overloaded constructor functions are _not_ updated, so that JSDoc can identify the class'
 * members correctly.)
 *
 * Using this plugin allows you to link to overloaded functions without manually adding `@variation`
 * tags to your documentation.
 *
 * For example, suppose your code includes a function named `foo` that you can call in the
 * following ways:
 *
 * + `foo()`
 * + `foo(bar)`
 * + `foo(bar, baz)` (where `baz` is repeatable)
 *
 * This plugin assigns the following variations and longnames to each version of `foo`:
 *
 * + `foo()` gets the variation `()` and the longname `foo()`.
 * + `foo(bar)` gets the variation `(bar)` and the longname `foo(bar)`.
 * + `foo(bar, baz)` (where `baz` is repeatable) gets the variation `(bar, ...baz)` and the longname
 * `foo(bar, ...baz)`.
 *
 * You can then link to these functions with `{@link foo()}`, `{@link foo(bar)}`, and
 * `{@link foo(bar, ...baz)`. Note that the variation is based on the names of the function
 * parameters, _not_ their types.
 *
 * If you prefer to manually assign variations to certain functions, you can still do so with the
 * `@variation` tag. This plugin will not change these variations or add more variations for that
 * function, as long as the variations you've defined result in unique longnames.
 *
 * If an overloaded function includes multiple signatures with the same parameter names, the plugin
 * will assign numeric variations instead, starting at `(1)` and counting upwards.
 *
 * @module plugins/overloadHelper
 */
// lookup table of function doclets by longname
let functionDoclets;

function hasUniqueValues(obj) {
    let isUnique = true;
    const seen = [];

    Object.keys(obj).forEach(key => {
        if (seen.includes(obj[key])) {
            isUnique = false;
        }

        seen.push(obj[key]);
    });

    return isUnique;
}

function getParamNames(params) {
    const names = [];

    params.forEach(param => {
        let name = param.name || '';

        if (param.variable) {
            name = `...${name}`;
        }
        if (name !== '') {
            names.push(name);
        }
    });

    return names.length ? names.join(', ') : '';
}

function getParamVariation({params}) {
    return getParamNames(params || []);
}

function getUniqueVariations(doclets) {
    let counter = 0;
    const variations = {};
    const docletKeys = Object.keys(doclets);

    function getUniqueNumbers() {
        docletKeys.forEach(doclet => {
            let newLongname;

            while (true) {
                counter++;
                variations[doclet] = String(counter);

                // is this longname + variation unique?
                newLongname = `${doclets[doclet].longname}(${variations[doclet]})`;
                if ( !functionDoclets[newLongname] ) {
                    break;
                }
            }
        });
    }

    function getUniqueNames() {
        // start by trying to preserve existing variations
        docletKeys.forEach(doclet => {
            variations[doclet] = doclets[doclet].variation || getParamVariation(doclets[doclet]);
        });

        // if they're identical, try again, without preserving existing variations
        if ( !hasUniqueValues(variations) ) {
            docletKeys.forEach(doclet => {
                variations[doclet] = getParamVariation(doclets[doclet]);
            });

            // if they're STILL identical, switch to numeric variations
            if ( !hasUniqueValues(variations) ) {
                getUniqueNumbers();
            }
        }
    }

    // are we already using numeric variations? if so, keep doing that
    if (functionDoclets[`${doclets.newDoclet.longname}(1)`]) {
        getUniqueNumbers();
    }
    else {
        getUniqueNames();
    }

    return variations;
}

function ensureUniqueLongname(newDoclet) {
    const doclets = {
        oldDoclet: functionDoclets[newDoclet.longname],
        newDoclet: newDoclet
    };
    const docletKeys = Object.keys(doclets);
    let oldDocletLongname;
    let variations = {};

    if (doclets.oldDoclet) {
        oldDocletLongname = doclets.oldDoclet.longname;
        // if the shared longname has a variation, like MyClass#myLongname(variation),
        // remove the variation
        if (doclets.oldDoclet.variation || doclets.oldDoclet.variation === '') {
            docletKeys.forEach(doclet => {
                doclets[doclet].longname = doclets[doclet].longname.replace(/\([\s\S]*\)$/, '');
                doclets[doclet].variation = null;
            });
        }

        variations = getUniqueVariations(doclets);

        // update the longnames/variations
        docletKeys.forEach(doclet => {
            doclets[doclet].longname += `(${variations[doclet]})`;
            doclets[doclet].variation = variations[doclet];
        });

        // update the old doclet in the lookup table
        functionDoclets[oldDocletLongname] = null;
        functionDoclets[doclets.oldDoclet.longname] = doclets.oldDoclet;
    }

    // always store the new doclet in the lookup table
    functionDoclets[doclets.newDoclet.longname] = doclets.newDoclet;

    return doclets.newDoclet;
}

exports.handlers = {
    parseBegin() {
        functionDoclets = {};
    },

    newDoclet(e) {
        if (e.doclet.kind === 'function') {
            e.doclet = ensureUniqueLongname(e.doclet);
        }
    },

    parseComplete() {
        functionDoclets = null;
    }
};

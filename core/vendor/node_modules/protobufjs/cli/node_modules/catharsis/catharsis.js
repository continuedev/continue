/**
 * Catharsis
 * A parser for Google Closure Compiler type expressions, powered by PEG.js.
 *
 * @author Jeff Williams <jeffrey.l.williams@gmail.com>
 * @license MIT
 */

const describe = require('./lib/describe');
const { parse } = require('./lib/parser');
const stringify = require('./lib/stringify');

const typeExpressionCache = {
    normal: new Map(),
    jsdoc: new Map()
};

const parsedTypeCache = {
    normal: new Map(),
    htmlSafe: new Map()
};

const descriptionCache = {
    normal: new Map()
};

function getTypeExpressionCache({useCache, jsdoc}) {
    if (useCache === false) {
        return null;
    } else if (jsdoc === true) {
        return typeExpressionCache.jsdoc;
    } else {
        return typeExpressionCache.normal;
    }
}

function getParsedTypeCache({useCache, links, htmlSafe}) {
    if (useCache === false || links !== null || links !== undefined) {
        return null;
    } else if (htmlSafe === true) {
        return parsedTypeCache.htmlSafe;
    } else {
        return parsedTypeCache.normal;
    }
}

function getDescriptionCache({useCache, links}) {
    if (useCache === false || links !== null || links !== undefined) {
        return null;
    } else {
        return descriptionCache.normal;
    }
}

// can't return the original if any of the following are true:
// 1. restringification was requested
// 2. htmlSafe option was requested
// 3. links option was provided
// 4. typeExpression property is missing
function canReturnOriginalExpression(parsedType, {restringify, htmlSafe, links}) {
    return restringify !== true && htmlSafe !== true &&
        (links === null || links === undefined) &&
        Object.prototype.hasOwnProperty.call(parsedType, 'typeExpression');
}

// Add non-enumerable properties to a result object, then freeze it.
function prepareFrozenObject(obj, expr, {jsdoc}) {
    Object.defineProperty(obj, 'jsdoc', {
        value: jsdoc === true ? jsdoc : false
    });

    if (expr) {
        Object.defineProperty(obj, 'typeExpression', {
            value: expr
        });
    }

    return Object.freeze(obj);
}

function cachedParse(expr, options) {
    const cache = getTypeExpressionCache(options);
    let parsedType = cache ? cache.get(expr) : null;

    if (parsedType) {
        return parsedType;
    } else {
        parsedType = parse(expr, options);
        parsedType = prepareFrozenObject(parsedType, expr, options);

        if (cache) {
            cache.set(expr, parsedType);
        }

        return parsedType;
    }
}

function cachedStringify(parsedType, options) {
    const cache = getParsedTypeCache(options);
    let stringified;

    if (canReturnOriginalExpression(parsedType, options)) {
        return parsedType.typeExpression;
    } else if (cache) {
        stringified = cache.get(parsedType);
        if (!stringified) {
            stringified = stringify(parsedType, options);
            cache.set(parsedType, stringified);
        }

        return stringified;
    } else {
        return stringify(parsedType, options);
    }
}

function cachedDescribe(parsedType, options) {
    const cache = getDescriptionCache(options);
    let description = cache ? cache.get(parsedType) : null;

    if (description) {
        return description;
    } else {
        description = describe(parsedType, options);
        description = prepareFrozenObject(description, null, options);

        if (cache) {
            cache.set(parsedType, description);
        }

        return description;
    }
}

/* eslint-disable class-methods-use-this */
class Catharsis {
    constructor() {
        this.Types = require('./lib/types');
    }

    parse(typeExpr, options = {}) {
        typeExpr = typeExpr.replace(/[\r\n]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return cachedParse(typeExpr, options);
    }

    stringify(parsedType, options) {
        let result;

        options = options || {};

        result = cachedStringify(parsedType, options);
        if (options.validate) {
            this.parse(result, options);
        }

        return result;
    }

    describe(parsedType, options = {}) {
        return cachedDescribe(parsedType, options);
    }
}
/* eslint-enable class-methods-use-this */

module.exports = new Catharsis();

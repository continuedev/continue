/* eslint-disable indent, no-nested-ternary, space-infix-ops */
/**
    @overview Builds a tree-like JSON string from the doclet data.
    @version 0.0.3
    @example
        ./jsdoc scratch/jsdoc_test.js -t templates/haruki -d console -q format=xml
*/
const xml = require('js2xmlparser');

const hasOwnProp = Object.prototype.hasOwnProperty;

function graft(parentNode, childNodes, parentLongname) {
    childNodes
    .filter(({memberof}) => memberof === parentLongname)
    .forEach(element => {
        let i;
        let len;
        let thisClass;
        let thisEvent;
        let thisFunction;
        let thisMixin;
        let thisNamespace;

        if (element.kind === 'namespace') {
            if (!parentNode.namespaces) {
                parentNode.namespaces = [];
            }

            thisNamespace = {
                'name': element.name,
                'description': element.description || '',
                'access': element.access || '',
                'virtual': Boolean(element.virtual)
            };

            parentNode.namespaces.push(thisNamespace);

            graft(thisNamespace, childNodes, element.longname);
        }
        else if (element.kind === 'mixin') {
            if (!parentNode.mixins) {
                parentNode.mixins = [];
            }

            thisMixin = {
                'name': element.name,
                'description': element.description || '',
                'access': element.access || '',
                'virtual': Boolean(element.virtual)
            };

            parentNode.mixins.push(thisMixin);

            graft(thisMixin, childNodes, element.longname);
        }
        else if (element.kind === 'function') {
            if (!parentNode.functions) {
                parentNode.functions = [];
            }

            thisFunction = {
                'name': element.name,
                'access': element.access || '',
                'virtual': Boolean(element.virtual),
                'description': element.description || '',
                'parameters': [],
                'examples': []
            };

            parentNode.functions.push(thisFunction);

            if (element.returns) {
                thisFunction.returns = {
                    'type': element.returns[0].type? (element.returns[0].type.names.length === 1? element.returns[0].type.names[0] : element.returns[0].type.names) : '',
                    'description': element.returns[0].description || ''
                };
            }

            if (element.examples) {
                for (i = 0, len = element.examples.length; i < len; i++) {
                    thisFunction.examples.push(element.examples[i]);
                }
            }

            if (element.params) {
                for (i = 0, len = element.params.length; i < len; i++) {
                    thisFunction.parameters.push({
                        'name': element.params[i].name,
                        'type': element.params[i].type? (element.params[i].type.names.length === 1? element.params[i].type.names[0] : element.params[i].type.names) : '',
                        'description': element.params[i].description || '',
                        'default': hasOwnProp.call(element.params[i], 'defaultvalue') ? element.params[i].defaultvalue : '',
                        'optional': typeof element.params[i].optional === 'boolean'? element.params[i].optional : '',
                        'nullable': typeof element.params[i].nullable === 'boolean'? element.params[i].nullable : ''
                    });
                }
            }
        }
        else if (element.kind === 'member') {
            if (!parentNode.properties) {
                parentNode.properties = [];
            }
            parentNode.properties.push({
                'name': element.name,
                'access': element.access || '',
                'virtual': Boolean(element.virtual),
                'description': element.description || '',
                'type': element.type? (element.type.length === 1? element.type[0] : element.type) : ''
            });
        }

        else if (element.kind === 'event') {
            if (!parentNode.events) {
                parentNode.events = [];
            }

            thisEvent = {
                'name': element.name,
                'access': element.access || '',
                'virtual': Boolean(element.virtual),
                'description': element.description || '',
                'parameters': [],
                'examples': []
            };

            parentNode.events.push(thisEvent);

            if (element.returns) {
                thisEvent.returns = {
                    'type': element.returns.type ? (element.returns.type.names.length === 1 ? element.returns.type.names[0] : element.returns.type.names) : '',
                    'description': element.returns.description || ''
                };
            }

            if (element.examples) {
                for (i = 0, len = element.examples.length; i < len; i++) {
                    thisEvent.examples.push(element.examples[i]);
                }
            }

            if (element.params) {
                for (i = 0, len = element.params.length; i < len; i++) {
                    thisEvent.parameters.push({
                        'name': element.params[i].name,
                        'type': element.params[i].type? (element.params[i].type.names.length === 1? element.params[i].type.names[0] : element.params[i].type.names) : '',
                        'description': element.params[i].description || '',
                        'default': hasOwnProp.call(element.params[i], 'defaultvalue') ? element.params[i].defaultvalue : '',
                        'optional': typeof element.params[i].optional === 'boolean'? element.params[i].optional : '',
                        'nullable': typeof element.params[i].nullable === 'boolean'? element.params[i].nullable : ''
                    });
                }
            }
        }
        else if (element.kind === 'class') {
            if (!parentNode.classes) {
                parentNode.classes = [];
            }

            thisClass = {
                'name': element.name,
                'description': element.classdesc || '',
                'extends': element.augments || [],
                'access': element.access || '',
                'virtual': Boolean(element.virtual),
                'fires': element.fires || '',
                'constructor': {
                    'name': element.name,
                    'description': element.description || '',
                    'parameters': [
                    ],
                    'examples': []
                }
            };

            parentNode.classes.push(thisClass);

            if (element.examples) {
                for (i = 0, len = element.examples.length; i < len; i++) {
                    thisClass.constructor.examples.push(element.examples[i]);
                }
            }

            if (element.params) {
                for (i = 0, len = element.params.length; i < len; i++) {
                    thisClass.constructor.parameters.push({
                        'name': element.params[i].name,
                        'type': element.params[i].type? (element.params[i].type.names.length === 1? element.params[i].type.names[0] : element.params[i].type.names) : '',
                        'description': element.params[i].description || '',
                        'default': hasOwnProp.call(element.params[i], 'defaultvalue') ? element.params[i].defaultvalue : '',
                        'optional': typeof element.params[i].optional === 'boolean'? element.params[i].optional : '',
                        'nullable': typeof element.params[i].nullable === 'boolean'? element.params[i].nullable : ''
                    });
                }
            }

            graft(thisClass, childNodes, element.longname);
       }
    });
}

/**
    @param {TAFFY} data
    @param {object} opts
 */
exports.publish = (data, {destination, query}) => {
    let docs;
    const root = {};

    data({undocumented: true}).remove();
    docs = data().get(); // <-- an array of Doclet objects

    graft(root, docs);

    if (destination === 'console') {
        if (query && query.format === 'xml') {
            console.log( xml.parse('jsdoc', root) );
        }
        else {
            console.log( require('jsdoc/util/dumper').dump(root) );
        }
    }
    else {
        console.log('This template only supports output to the console. Use the option "-d console" when you run JSDoc.');
    }
};

'use strict';

var env = require('jsdoc/env');
var path = require('jsdoc/path');

describe('markdown plugin', function() {
    var pluginPath = 'plugins/markdown';
    var pluginPathResolved = path.join(env.dirname, pluginPath);
    var plugin = require(pluginPathResolved);

    var docSet = jasmine.getDocSetFromFile('plugins/test/fixtures/markdown.js');

    // TODO: more tests; refactor the plugin so multiple settings can be tested

    it('should process the correct tags by default', function() {
        var myClass = docSet.getByLongname('MyClass')[0];

        plugin.handlers.newDoclet({ doclet: myClass });
        [
            myClass.author[0],
            myClass.classdesc,
            myClass.description,
            myClass.exceptions[0].description,
            myClass.params[0].description,
            myClass.properties[0].description,
            myClass.returns[0].description,
            myClass.see,
            myClass.summary
        ].forEach(function(value) {
            // if we processed the value, it should be wrapped in a <p> tag
            expect( /^<p>(?:.+)<\/p>$/.test(value) ).toBe(true);
        });
    });

    it('should unescape &quot; entities in inline tags, but not elsewhere', function() {
        var myOtherClass = docSet.getByLongname('MyOtherClass')[0];

        plugin.handlers.newDoclet({ doclet: myOtherClass });

        expect(myOtherClass.description).toContain('chat."#channel"."say-\\"hello\\""');
        expect(myOtherClass.description).toContain('&quot;See&quot;');
    });

    describe('@see tag support', function() {
        var foo = docSet.getByLongname('foo')[0];
        var bar = docSet.getByLongname('bar')[0];

        it('should parse @see tags containing links', function() {
            plugin.handlers.newDoclet({ doclet: foo });
            expect(typeof foo).toEqual('object');
            expect(foo.see[0]).toEqual('<p><a href="http://nowhere.com">Nowhere</a></p>');
        });

        it('should not parse @see tags that do not contain links', function() {
            plugin.handlers.newDoclet({ doclet: bar });
            expect(typeof bar).toEqual('object');
            expect(bar.see[0]).toEqual('AnObject#myProperty');
        });
    });
});

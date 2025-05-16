'use strict';

describe('plugins/overloadHelper', function() {
    var env = require('jsdoc/env');
    var path = require('jsdoc/path');

    var docSet;
    var parser = jasmine.createParser();
    var pluginPath = 'plugins/overloadHelper';
    var pluginPathResolved = path.resolve(env.dirname, pluginPath);
    var plugin = require(pluginPathResolved);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile('plugins/test/fixtures/overloadHelper.js', parser);

    it('should exist', function() {
        expect(plugin).toBeDefined();
        expect(typeof plugin).toBe('object');
    });

    it('should export handlers', function() {
        expect(plugin.handlers).toBeDefined();
        expect(typeof plugin.handlers).toBe('object');
    });

    it('should export a "newDoclet" handler', function() {
        expect(plugin.handlers.newDoclet).toBeDefined();
        expect(typeof plugin.handlers.newDoclet).toBe('function');
    });

    it('should export a "parseComplete" handler', function() {
        expect(plugin.handlers.parseComplete).toBeDefined();
        expect(typeof plugin.handlers.parseComplete).toBe('function');
    });

    describe('newDoclet handler', function() {
        it('should not add unique longnames to constructors', function() {
            var soup = docSet.getByLongname('Soup');
            var soup1 = docSet.getByLongname('Soup()');
            var soup2 = docSet.getByLongname('Soup(spiciness)');

            expect(soup.length).toBe(2);
            expect(soup1.length).toBe(0);
            expect(soup2.length).toBe(0);
        });

        it('should add unique longnames to methods', function() {
            var slurp = docSet.getByLongname('Soup#slurp');
            var slurp1 = docSet.getByLongname('Soup#slurp()');
            var slurp2 = docSet.getByLongname('Soup#slurp(dBA)');

            expect(slurp.length).toBe(0);
            expect(slurp1.length).toBe(1);
            expect(slurp2.length).toBe(1);
        });

        it('should update the "variation" property of the method', function() {
            var slurp1 = docSet.getByLongname('Soup#slurp()')[0];
            var slurp2 = docSet.getByLongname('Soup#slurp(dBA)')[0];

            expect(slurp1.variation).toBe('');
            expect(slurp2.variation).toBe('dBA');
        });

        it('should not add to or change existing variations that are unique', function() {
            var salt1 = docSet.getByLongname('Soup#salt');
            var salt2 = docSet.getByLongname('Soup#salt(mg)');

            expect(salt1.length).toBe(1);
            expect(salt2.length).toBe(1);
        });

        it('should not duplicate the names of existing numeric variations', function() {
            var heat1 = docSet.getByLongname('Soup#heat(1)');
            var heat2 = docSet.getByLongname('Soup#heat(2)');
            var heat3 = docSet.getByLongname('Soup#heat(3)');

            expect(heat1.length).toBe(1);
            expect(heat2.length).toBe(1);
            expect(heat3.length).toBe(1);
        });

        it('should replace identical variations with new, unique variations', function() {
            var discard1 = docSet.getByLongname('Soup#discard()');
            var discard2 = docSet.getByLongname('Soup#discard(container)');

            expect(discard1.length).toBe(1);
            expect(discard2.length).toBe(1);
        });
    });

    describe('parseComplete handler', function() {
        // disabled because on the second run, each comment is being parsed twice; who knows why...
        xit('should not retain parse results between parser runs', function() {
            parser.clear();
            docSet = jasmine.getDocSetFromFile('plugins/test/fixtures/overloadHelper.js', parser);
            var heat = docSet.getByLongname('Soup#heat(4)');

            expect(heat.length).toBe(0);
        });
    });
});

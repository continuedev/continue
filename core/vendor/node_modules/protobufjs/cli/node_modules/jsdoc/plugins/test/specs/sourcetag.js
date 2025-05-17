'use strict';

describe('sourcetag plugin', function() {
    var env = require('jsdoc/env');
    var path = require('jsdoc/path');

    var docSet;
    var parser = jasmine.createParser();
    var pluginPath = 'plugins/sourcetag';
    var pluginPathResolved = path.join(env.dirname, pluginPath);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile(pluginPath + '.js', parser);

    it("should set the lineno and filename of the doclet's meta property", function() {
        var doclet = docSet.getByLongname('module:plugins/sourcetag.handlers.newDoclet');

        expect(doclet[0].meta).toBeDefined();
        expect(doclet[0].meta.filename).toEqual('sourcetag.js');
        expect(doclet[0].meta.lineno).toEqual(9);
    });
});

'use strict';

describe('commentConvert plugin', function() {
    var env = require('jsdoc/env');
    var path = require('jsdoc/path');

    var docSet;
    var parser = jasmine.createParser();
    var pluginPath = 'plugins/commentConvert';
    var pluginPathResolved = path.join(env.dirname, pluginPath);
    var plugin = require(pluginPathResolved);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile(pluginPath + '.js', parser);

    it('should convert ///-style comments into jsdoc comments', function() {
        var doclet = docSet.getByLongname('module:plugins/commentConvert.handlers.beforeParse');
        expect(doclet.length).toEqual(1);
    });
});

'use strict';

describe('underscore plugin', function () {
    var env = require('jsdoc/env');
    var path = require('jsdoc/path');

    var docSet;
    var parser = jasmine.createParser();
    var pluginPath = 'plugins/underscore';
    var fixturePath = 'plugins/test/fixtures/underscore';
    var pluginPathResolved = path.join(env.dirname, pluginPath);
    var plugin = require(pluginPathResolved);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile(fixturePath + '.js', parser);

    it('should not mark normal, public properties as private', function() {
        // Base line tests
        var normal = docSet.getByLongname('normal');
        expect(normal[0].access).toBeUndefined();

        var realPrivate = docSet.getByLongname('Klass#privateProp');
        expect(realPrivate[0].access).toEqual('private');
    });

    it('should hide doclet for symbols beginning with an underscore under normal circumstances', function () {
        var hidden = docSet.getByLongname('_hidden');
        expect(hidden[0].access).toEqual('private');
    });

    it('picks up "this"', function() {
        var privateUnderscore = docSet.getByLongname('Klass#_privateProp');
        expect(privateUnderscore[0].access).toEqual('private');
    });
});

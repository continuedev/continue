'use strict';

describe('escapeHtml plugin', function() {
    var env = require('jsdoc/env');
    var path = require('jsdoc/path');

    var docSet;
    var parser = jasmine.createParser();
    var pluginPath = 'plugins/escapeHtml';
    var pluginPathResolved = path.join(env.dirname, pluginPath);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile(pluginPath + '.js', parser);

    it("should escape '&', '<' and newlines in doclet descriptions", function() {
        var doclet = docSet.getByLongname('module:plugins/escapeHtml.handlers.newDoclet');

        expect(doclet[0].description).toEqual('Translate HTML tags in descriptions into safe entities. Replaces &lt;, &amp; and newlines');
    });
});

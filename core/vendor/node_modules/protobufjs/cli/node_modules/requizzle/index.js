/*
    Copyright (c) 2014 Google Inc. All rights reserved.

    Use of this source code is governed by the MIT License, available in this package's LICENSE file
    or at http://opensource.org/licenses/MIT.
 */
const _ = require('lodash');
const Requizzle = require('./lib/requizzle');

module.exports = function requizzle(options) {
    let instance;

    if (!options || typeof options !== 'object') {
        throw new TypeError('Requizzle\'s options parameter must be a non-null object.');
    }
    options = _.clone(options);
    options.parent = module.parent;

    return filepath => {
        instance = instance || new Requizzle(options);

        return instance.requizzle(filepath);
    };
};
module.exports.Requizzle = Requizzle;

// force Node.js to reload this module each time it's required, so module.parent is always correct
delete require.cache[__filename];

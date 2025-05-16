"use strict";
module.exports = json_module;

var util = require("../util");

var protobuf = require("../..");

json_module.description = "JSON representation as a module";

function jsonSafeProp(json) {
    return json.replace(/^( +)"(\w+)":/mg, function($0, $1, $2) {
        return protobuf.util.safeProp($2).charAt(0) === "."
            ? $1 + $2 + ":"
            : $0;
    });
}

function json_module(root, options, callback) {
    try {
        var rootProp = protobuf.util.safeProp(options.root || "default");
        var output = [
            (options.es6 ? "const" : "var") + " $root = ($protobuf.roots" + rootProp + " || ($protobuf.roots" + rootProp + " = new $protobuf.Root()))\n"
        ];
        if (root.options) {
            var optionsJson = jsonSafeProp(JSON.stringify(root.options, null, 2));
            output.push(".setOptions(" + optionsJson + ")\n");
        }
        var json = jsonSafeProp(JSON.stringify(root.nested, null, 2).trim());
        output.push(".addJSON(" + json + ");");
        output = util.wrap(output.join(""), protobuf.util.merge({ dependency: "protobufjs/light" }, options));
        process.nextTick(function() {
            callback(null, output);
        });
    } catch (e) {
        return callback(e);
    }
    return undefined;
}

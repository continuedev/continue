"use strict";
module.exports = proto2_target;

var protobuf = require("../..");

proto2_target.description = "Protocol Buffers, Version 2";

function proto2_target(root, options, callback) {
    require("./proto")(root, protobuf.util.merge(options, { syntax: "proto2" }), callback);
}
